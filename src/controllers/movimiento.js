import db from '../db.js';
import { BadRequestError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { MovimientoNormalizador } from '../normalizers/movimientoNormalizador.js';

const TIPOS_VALIDOS = ['entrada', 'salida', 'traspaso'];
const UBICACIONES_VALIDAS = ['almacen', 'tienda'];

const SELECT_MOVIMIENTO = `
  m.public_id, m.tipo, m.cantidad, m.motivo, m.fecha_creacion,
  p.public_id AS producto_public_id, p.nombre AS producto_nombre,
  m.ubicacion_tipo,
  COALESCE(a.public_id, t.public_id) AS ubicacion_public_id,
  COALESCE(a.nombre, t.nombre) AS ubicacion_nombre,
  m.ubicacion_destino_tipo,
  COALESCE(ad.public_id, td.public_id) AS ubicacion_destino_public_id,
  COALESCE(ad.nombre, td.nombre) AS ubicacion_destino_nombre,
  u.nombre AS creado_por_nombre`;

const FROM_MOVIMIENTO = `
  FROM S_movimientos m
  JOIN S_productos p ON p.id = m.producto_id
  JOIN S_usuarios u ON u.id = m.creado_por
  LEFT JOIN S_almacenes a  ON a.id  = m.ubicacion_id         AND m.ubicacion_tipo = 'almacen'
  LEFT JOIN S_tiendas   t  ON t.id  = m.ubicacion_id         AND m.ubicacion_tipo = 'tienda'
  LEFT JOIN S_almacenes ad ON ad.id = m.ubicacion_destino_id AND m.ubicacion_destino_tipo = 'almacen'
  LEFT JOIN S_tiendas   td ON td.id = m.ubicacion_destino_id AND m.ubicacion_destino_tipo = 'tienda'`;

const buscarProducto = async (publicId, empresaId) => {
  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!producto) throw new NotFoundError('Producto no encontrado');
  return producto.id;
};

// Resuelve un almacen o una tienda por su public_id segun tipo -- s_movimientos
// no tiene FK fisica en ubicacion_id/ubicacion_destino_id (polimorfico, ver
// bd/schema/tables.sql), esta validacion es lo que garantiza que el id
// interno que llega al INSERT realmente exista y sea de esta empresa.
const buscarUbicacion = async (tipo, publicId, empresaId) => {
  if (tipo === 'almacen') {
    const { rows: [almacen] } = await db.query(
      `SELECT id FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
      [publicId, empresaId]
    );
    if (!almacen) throw new NotFoundError('Almacen no encontrado');
    return almacen.id;
  }
  const { rows: [tienda] } = await db.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!tienda) throw new NotFoundError('Tienda no encontrada');
  return tienda.id;
};

// trg_aplicar_movimiento_stock (AFTER INSERT) aplica el efecto sobre
// S_producto_almacen/S_producto_tienda -- un solo INSERT ya es atomico, sin
// necesidad de BEGIN/COMMIT manual (a diferencia de venta.create, que si
// necesita transaccion propia por tener varias lineas).
export const create = async (req, res) => {
  const {
    producto_id, tipo, ubicacion_tipo, ubicacion_id,
    ubicacion_destino_tipo, ubicacion_destino_id, cantidad, motivo,
  } = req.body;

  if (!TIPOS_VALIDOS.includes(tipo)) throw new BadRequestError('tipo debe ser entrada, salida o traspaso');
  if (!UBICACIONES_VALIDAS.includes(ubicacion_tipo)) throw new BadRequestError('ubicacion_tipo debe ser almacen o tienda');
  if (!cantidad || cantidad <= 0) throw new BadRequestError('cantidad debe ser mayor a 0');

  if (tipo === 'traspaso') {
    if (!UBICACIONES_VALIDAS.includes(ubicacion_destino_tipo)) throw new BadRequestError('ubicacion_destino_tipo debe ser almacen o tienda');
    if (!ubicacion_destino_id) throw new BadRequestError('ubicacion_destino_id es requerido para un traspaso');
  } else if (ubicacion_destino_tipo || ubicacion_destino_id) {
    throw new BadRequestError('ubicacion_destino_tipo/ubicacion_destino_id solo aplican a un traspaso');
  }

  const productoInternoId = await buscarProducto(validarUUID(producto_id), req.user.empresa_id);
  const ubicacionInternaId = await buscarUbicacion(ubicacion_tipo, validarUUID(ubicacion_id), req.user.empresa_id);
  const destinoInternoId = tipo === 'traspaso'
    ? await buscarUbicacion(ubicacion_destino_tipo, validarUUID(ubicacion_destino_id), req.user.empresa_id)
    : null;

  const { rows: [movimiento] } = await db.query(
    `INSERT INTO S_movimientos
       (empresa_id, producto_id, tipo, ubicacion_tipo, ubicacion_id,
        ubicacion_destino_tipo, ubicacion_destino_id, cantidad, motivo, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING public_id`,
    [req.user.empresa_id, productoInternoId, tipo, ubicacion_tipo, ubicacionInternaId,
     ubicacion_destino_tipo ?? null, destinoInternoId, cantidad, motivo ?? null, req.user.id]
  );

  const { rows: [fila] } = await db.query(`SELECT ${SELECT_MOVIMIENTO} ${FROM_MOVIMIENTO} WHERE m.public_id = $1`, [movimiento.public_id]);
  res.status(201).json(new MovimientoNormalizador(fila).normalizar());
};

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT ${SELECT_MOVIMIENTO}, COUNT(*) OVER() AS _total
     ${FROM_MOVIMIENTO}
     WHERE m.empresa_id = $1
     ORDER BY m.fecha_creacion DESC
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: MovimientoNormalizador.normalizarLista(data), meta });
};
