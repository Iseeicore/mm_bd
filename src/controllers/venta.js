import db from '../db.js';
import { BadRequestError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { VentaNormalizador } from '../normalizers/ventaNormalizador.js';
import { VentaDetalleNormalizador } from '../normalizers/ventaDetalleNormalizador.js';

const ORIGENES_VALIDOS = ['almacen', 'tienda'];

const SELECT_VENTA = `
  v.public_id, t.public_id AS tienda_public_id, t.nombre AS tienda_nombre,
  v.total, v.fecha_creacion, u.nombre AS creado_por_nombre`;

const FROM_VENTA = `
  FROM S_ventas v
  JOIN S_tiendas t ON t.id = v.tienda_id
  JOIN S_usuarios u ON u.id = v.creado_por`;

const SELECT_DETALLE = `
  p.public_id AS producto_public_id, p.nombre AS producto_nombre,
  vd.cantidad, vd.precio_unitario, vd.subtotal, vd.origen_tipo,
  COALESCE(a.public_id, t.public_id) AS origen_public_id,
  COALESCE(a.nombre, t.nombre) AS origen_nombre`;

const FROM_DETALLE = `
  FROM S_venta_detalle vd
  JOIN S_productos p ON p.id = vd.producto_id
  LEFT JOIN S_almacenes a ON a.id = vd.origen_id AND vd.origen_tipo = 'almacen'
  LEFT JOIN S_tiendas   t ON t.id = vd.origen_id AND vd.origen_tipo = 'tienda'
  WHERE vd.venta_id = $1
  ORDER BY vd.id`;

// Los 3 helpers toman `queryable` (client de una transaccion o el pool
// `db`) para poder correr dentro del BEGIN/COMMIT manual de create().
const buscarTienda = async (queryable, publicId, empresaId) => {
  const { rows: [tienda] } = await queryable.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!tienda) throw new NotFoundError('Tienda no encontrada');
  return tienda.id;
};

const buscarOrigen = async (queryable, tipo, publicId, empresaId) => {
  if (tipo === 'almacen') {
    const { rows: [almacen] } = await queryable.query(
      `SELECT id FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
      [publicId, empresaId]
    );
    if (!almacen) throw new NotFoundError('Almacen no encontrado');
    return almacen.id;
  }
  const { rows: [tienda] } = await queryable.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!tienda) throw new NotFoundError('Tienda no encontrada');
  return tienda.id;
};

const buscarProductoConPrecio = async (queryable, publicId, empresaId) => {
  const { rows: [producto] } = await queryable.query(
    `SELECT id, precio_venta_unidad FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!producto) throw new NotFoundError('Producto no encontrado');
  return producto;
};

// Unica funcion del modulo con BEGIN/COMMIT manual (mismo criterio que
// registro.js): una venta con varias lineas tiene que ser atomica -- si una
// linea falla (sin stock en el origen elegido por el cajero), no se vende
// "la mitad" de la venta.
export const create = async (req, res) => {
  const { tienda_id, lineas } = req.body;

  if (!tienda_id) throw new BadRequestError('El campo tienda_id es requerido');
  if (!Array.isArray(lineas) || lineas.length === 0) throw new BadRequestError('La venta necesita al menos una linea');
  for (const linea of lineas) {
    if (!linea.producto_id || !linea.cantidad || linea.cantidad <= 0)
      throw new BadRequestError('Cada linea necesita producto_id y cantidad > 0');
    if (!ORIGENES_VALIDOS.includes(linea.origen_tipo) || !linea.origen_id)
      throw new BadRequestError('Cada linea necesita origen_tipo (almacen o tienda) y origen_id');
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const tiendaInternaId = await buscarTienda(client, validarUUID(tienda_id), req.user.empresa_id);

    const { rows: [venta] } = await client.query(
      `INSERT INTO S_ventas (empresa_id, tienda_id, creado_por) VALUES ($1,$2,$3) RETURNING id, public_id`,
      [req.user.empresa_id, tiendaInternaId, req.user.id]
    );

    for (const linea of lineas) {
      const producto = await buscarProductoConPrecio(client, validarUUID(linea.producto_id), req.user.empresa_id);
      const origenInternoId = await buscarOrigen(client, linea.origen_tipo, validarUUID(linea.origen_id), req.user.empresa_id);

      // precio_unitario es un snapshot del precio actual del producto -- el
      // cliente no lo manda, asi una venta vieja no cambia de precio si el
      // producto se repricea despues.
      await client.query(
        `INSERT INTO S_venta_detalle (venta_id, producto_id, cantidad, precio_unitario, origen_tipo, origen_id)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [venta.id, producto.id, linea.cantidad, producto.precio_venta_unidad, linea.origen_tipo, origenInternoId]
      );
    }

    await client.query(
      `UPDATE S_ventas SET total = (SELECT SUM(subtotal) FROM S_venta_detalle WHERE venta_id = $1) WHERE id = $1`,
      [venta.id]
    );

    await client.query('COMMIT');

    const { rows: [ventaCompleta] } = await db.query(`SELECT ${SELECT_VENTA} ${FROM_VENTA} WHERE v.public_id = $1`, [venta.public_id]);
    const { rows: detalle } = await db.query(`SELECT ${SELECT_DETALLE} ${FROM_DETALLE}`, [venta.id]);

    res.status(201).json({
      ...new VentaNormalizador(ventaCompleta).normalizar(),
      detalle: VentaDetalleNormalizador.normalizarLista(detalle),
    });

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT ${SELECT_VENTA}, COUNT(*) OVER() AS _total
     ${FROM_VENTA}
     WHERE v.empresa_id = $1
     ORDER BY v.fecha_creacion DESC
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: VentaNormalizador.normalizarLista(data), meta });
};

export const getById = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { rows: [venta] } = await db.query(
    `SELECT v.id, ${SELECT_VENTA} ${FROM_VENTA} WHERE v.public_id = $1 AND v.empresa_id = $2`,
    [public_id, req.user.empresa_id]
  );
  if (!venta) throw new NotFoundError();

  const { rows: detalle } = await db.query(`SELECT ${SELECT_DETALLE} ${FROM_DETALLE}`, [venta.id]);

  res.json({
    ...new VentaNormalizador(venta).normalizar(),
    detalle: VentaDetalleNormalizador.normalizarLista(detalle),
  });
};
