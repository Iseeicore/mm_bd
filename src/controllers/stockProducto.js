import db from '../db.js';
import { BadRequestError, NotFoundError, validarUUID } from '../utils/error.js';
import { StockUbicacionNormalizador } from '../normalizers/stockUbicacionNormalizador.js';

const buscarProducto = async (publicId, empresaId) => {
  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [publicId, empresaId]
  );
  if (!producto) throw new NotFoundError();
  return producto;
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
