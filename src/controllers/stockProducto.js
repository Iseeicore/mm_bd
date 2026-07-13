import db from '../db.js';
import { BadRequestError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { StockUbicacionNormalizador } from '../normalizers/stockUbicacionNormalizador.js';
import { ProductoStockNormalizador } from '../normalizers/productoStockNormalizador.js';

const buscarProducto = async (publicId, empresaId) => {
  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!producto) throw new NotFoundError();
  return producto;
};

const buscarAlmacen = async (publicId, empresaId) => {
  const { rows: [almacen] } = await db.query(
    `SELECT id FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!almacen) throw new NotFoundError();
  return almacen;
};

const buscarTienda = async (publicId, empresaId) => {
  const { rows: [tienda] } = await db.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!tienda) throw new NotFoundError();
  return tienda;
};

// Arma la respuesta paginada+normalizada compartida por las 4 funciones de
// abajo -- las queries en si quedan explicitas en cada una (nunca se
// interpola un nombre de tabla en el SQL).
const responderListadoProductos = (res, rows, page, limit) => {
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: ProductoStockNormalizador.normalizarLista(data), meta });
};

// Inversa de obtenerStock: dado un almacen, que productos tiene.
export const listarProductosAlmacen = async (req, res) => {
  const almacen = await buscarAlmacen(validarUUID(req.params.id), req.user.empresa_id);
  const { page, limit, offset } = paginar(req.query);

  const { rows } = await db.query(
    `SELECT p.public_id AS producto_public_id, p.nombre AS producto_nombre,
            p.precio_venta_unidad, p.precio_venta_paquete, p.unidades_por_paquete,
            pa.stock_actual, (pa.stock_actual / p.unidades_por_paquete) AS paquetes_completos,
            pa.stock_minimo, pa.fecha_actualizacion,
            COUNT(*) OVER() AS _total
     FROM S_producto_almacen pa
     JOIN S_productos p ON p.id = pa.producto_id
     WHERE pa.almacen_id = $1 AND p.activo = TRUE
     ORDER BY p.nombre
     LIMIT $2 OFFSET $3`,
    [almacen.id, limit, offset]
  );

  responderListadoProductos(res, rows, page, limit);
};

// Usa idx_pa_stock_bajo (WHERE stock_actual <= stock_minimo), que existia en
// el schema desde Fase 1 sin ningun endpoint que lo usara.
export const listarProductosAlmacenStockBajo = async (req, res) => {
  const almacen = await buscarAlmacen(validarUUID(req.params.id), req.user.empresa_id);
  const { page, limit, offset } = paginar(req.query);

  const { rows } = await db.query(
    `SELECT p.public_id AS producto_public_id, p.nombre AS producto_nombre,
            p.precio_venta_unidad, p.precio_venta_paquete, p.unidades_por_paquete,
            pa.stock_actual, (pa.stock_actual / p.unidades_por_paquete) AS paquetes_completos,
            pa.stock_minimo, pa.fecha_actualizacion,
            COUNT(*) OVER() AS _total
     FROM S_producto_almacen pa
     JOIN S_productos p ON p.id = pa.producto_id
     WHERE pa.almacen_id = $1 AND p.activo = TRUE AND pa.stock_actual <= pa.stock_minimo
     ORDER BY pa.stock_actual ASC
     LIMIT $2 OFFSET $3`,
    [almacen.id, limit, offset]
  );

  responderListadoProductos(res, rows, page, limit);
};

// Inversa de obtenerStock: dado una tienda, que productos tiene.
export const listarProductosTienda = async (req, res) => {
  const tienda = await buscarTienda(validarUUID(req.params.id), req.user.empresa_id);
  const { page, limit, offset } = paginar(req.query);

  const { rows } = await db.query(
    `SELECT p.public_id AS producto_public_id, p.nombre AS producto_nombre,
            p.precio_venta_unidad, p.precio_venta_paquete, p.unidades_por_paquete,
            pt.stock_actual, (pt.stock_actual / p.unidades_por_paquete) AS paquetes_completos,
            pt.stock_minimo, pt.fecha_actualizacion,
            COUNT(*) OVER() AS _total
     FROM S_producto_tienda pt
     JOIN S_productos p ON p.id = pt.producto_id
     WHERE pt.tienda_id = $1 AND p.activo = TRUE
     ORDER BY p.nombre
     LIMIT $2 OFFSET $3`,
    [tienda.id, limit, offset]
  );

  responderListadoProductos(res, rows, page, limit);
};

// Usa idx_pt_stock_bajo (WHERE stock_actual <= stock_minimo), mismo criterio
// que la version de almacen.
export const listarProductosTiendaStockBajo = async (req, res) => {
  const tienda = await buscarTienda(validarUUID(req.params.id), req.user.empresa_id);
  const { page, limit, offset } = paginar(req.query);

  const { rows } = await db.query(
    `SELECT p.public_id AS producto_public_id, p.nombre AS producto_nombre,
            p.precio_venta_unidad, p.precio_venta_paquete, p.unidades_por_paquete,
            pt.stock_actual, (pt.stock_actual / p.unidades_por_paquete) AS paquetes_completos,
            pt.stock_minimo, pt.fecha_actualizacion,
            COUNT(*) OVER() AS _total
     FROM S_producto_tienda pt
     JOIN S_productos p ON p.id = pt.producto_id
     WHERE pt.tienda_id = $1 AND p.activo = TRUE AND pt.stock_actual <= pt.stock_minimo
     ORDER BY pt.stock_actual ASC
     LIMIT $2 OFFSET $3`,
    [tienda.id, limit, offset]
  );

  responderListadoProductos(res, rows, page, limit);
};

export const obtenerStock = async (req, res) => {
  const productoPublicId = validarUUID(req.params.id);
  const producto = await buscarProducto(productoPublicId, req.user.empresa_id);

  const { rows: filasAlmacen } = await db.query(
    `SELECT a.public_id, a.nombre, pa.stock_actual, pa.stock_minimo, pa.fecha_actualizacion
     FROM S_producto_almacen pa
     JOIN S_almacenes a ON a.id = pa.almacen_id
     WHERE pa.producto_id = $1 AND a.empresa_id = $2 AND a.activo = TRUE
     ORDER BY a.nombre`,
    [producto.id, req.user.empresa_id]
  );

  const { rows: filasTienda } = await db.query(
    `SELECT t.public_id, t.nombre, pt.stock_actual, pt.stock_minimo, pt.fecha_actualizacion
     FROM S_producto_tienda pt
     JOIN S_tiendas t ON t.id = pt.tienda_id
     WHERE pt.producto_id = $1 AND t.empresa_id = $2 AND t.activo = TRUE
     ORDER BY t.nombre`,
    [producto.id, req.user.empresa_id]
  );

  res.json({
    almacenes: StockUbicacionNormalizador.normalizarLista(filasAlmacen),
    tiendas: StockUbicacionNormalizador.normalizarLista(filasTienda),
  });
};

// UPSERT: la primera vez que se fija stock de un producto en un almacén crea
// la fila del pivot (S_producto_almacen no tiene un create/asociar aparte),
// las siguientes veces la actualiza. Mismo criterio para tiendas abajo.
export const actualizarStockAlmacen = async (req, res) => {
  const productoPublicId = validarUUID(req.params.id);
  const almacenPublicId = validarUUID(req.params.almacenId);
  const { stock_actual, stock_minimo } = req.body;

  if (stock_actual === undefined) throw new BadRequestError('El campo stock_actual es requerido');

  const producto = await buscarProducto(productoPublicId, req.user.empresa_id);

  const { rows: [almacen] } = await db.query(
    `SELECT id, nombre FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [almacenPublicId, req.user.empresa_id]
  );
  if (!almacen) throw new NotFoundError();

  const { rows } = await db.query(
    `INSERT INTO S_producto_almacen (producto_id, almacen_id, stock_actual, stock_minimo)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (producto_id, almacen_id) DO UPDATE
       SET stock_actual = EXCLUDED.stock_actual, stock_minimo = EXCLUDED.stock_minimo, fecha_actualizacion = NOW()
     RETURNING stock_actual, stock_minimo, fecha_actualizacion`,
    [producto.id, almacen.id, stock_actual, stock_minimo ?? null]
  );

  res.json(new StockUbicacionNormalizador({ ...rows[0], public_id: almacenPublicId, nombre: almacen.nombre }).normalizar());
};

export const actualizarStockTienda = async (req, res) => {
  const productoPublicId = validarUUID(req.params.id);
  const tiendaPublicId = validarUUID(req.params.tiendaId);
  const { stock_actual, stock_minimo } = req.body;

  if (stock_actual === undefined) throw new BadRequestError('El campo stock_actual es requerido');

  const producto = await buscarProducto(productoPublicId, req.user.empresa_id);

  const { rows: [tienda] } = await db.query(
    `SELECT id, nombre FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [tiendaPublicId, req.user.empresa_id]
  );
  if (!tienda) throw new NotFoundError();

  const { rows } = await db.query(
    `INSERT INTO S_producto_tienda (producto_id, tienda_id, stock_actual, stock_minimo)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (producto_id, tienda_id) DO UPDATE
       SET stock_actual = EXCLUDED.stock_actual, stock_minimo = EXCLUDED.stock_minimo, fecha_actualizacion = NOW()
     RETURNING stock_actual, stock_minimo, fecha_actualizacion`,
    [producto.id, tienda.id, stock_actual, stock_minimo ?? null]
  );

  res.json(new StockUbicacionNormalizador({ ...rows[0], public_id: tiendaPublicId, nombre: tienda.nombre }).normalizar());
};
