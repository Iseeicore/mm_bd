import db from '../db.js';
import { BadRequestError, NotFoundError, validarUUID, validarFecha } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { HistorialStockNormalizador } from '../normalizers/historialStockNormalizador.js';
import { MasVendidoNormalizador } from '../normalizers/masVendidoNormalizador.js';
import { TrazabilidadNormalizador } from '../normalizers/trazabilidadNormalizador.js';
import { TrazabilidadResumenNormalizador } from '../normalizers/trazabilidadResumenNormalizador.js';

const UBICACIONES_VALIDAS = ['almacen', 'tienda'];

const FROM_TRAZABILIDAD = `
  FROM v_historial_stock h
  JOIN S_productos p ON p.id = h.producto_id
  LEFT JOIN S_almacenes a ON a.id = h.ubicacion_id AND h.ubicacion_tipo = 'almacen'
  LEFT JOIN S_tiendas   t ON t.id = h.ubicacion_id AND h.ubicacion_tipo = 'tienda'`;

// Rango de dia SIEMPRE (>= / <), nunca fecha_creacion::date = $2 -- eso
// inutilizaria idx_mov_fecha_creacion/idx_vta_fecha_creacion (ledger #1).
const WHERE_TRAZABILIDAD = `
  WHERE h.empresa_id = $1
    AND h.fecha_creacion >= $2::date AND h.fecha_creacion < $2::date + 1
    AND ($3::int IS NULL OR h.producto_id = $3)
    AND ($4::text IS NULL OR h.ubicacion_tipo = $4)
    AND ($5::int IS NULL OR h.ubicacion_id = $5)`;

// producto_id es un filtro, no un recurso -- si el public_id no matchea nada
// en la empresa, no se lanza NotFoundError: se devuelve 0 (ningun id interno
// real puede ser 0) para que el filtro deje la lista vacia en vez de ignorarlo.
const resolverProductoId = async (publicId, empresaId) => {
  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2`,
    [validarUUID(publicId), empresaId]
  );
  return producto ? producto.id : 0;
};

// Mismo criterio que resolverProductoId, pero para origen_tipo/origen_id
// (almacen o tienda) -- mismo patron de resolucion polimorfica que
// buscarUbicacion en movimiento.js, sin el NotFoundError porque acá es filtro.
const resolverOrigenId = async (tipo, publicId, empresaId) => {
  if (tipo === 'almacen') {
    const { rows: [almacen] } = await db.query(
      `SELECT id FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2`,
      [publicId, empresaId]
    );
    return almacen ? almacen.id : 0;
  }
  const { rows: [tienda] } = await db.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2`,
    [publicId, empresaId]
  );
  return tienda ? tienda.id : 0;
};

// Valida fecha + origen_tipo/origen_id (deben venir juntos) + resuelve
// producto_id/origen_id de public_id a id interno -- compartido por
// trazabilidad y trazabilidadResumen, que solo difieren en el SELECT/GROUP BY.
const resolverFiltrosTrazabilidad = async (req) => {
  const fecha = validarFecha(req.query.fecha);
  const { origen_tipo: origenTipo, origen_id: origenId, producto_id: productoPublicId } = req.query;

  if ((origenTipo && !origenId) || (!origenTipo && origenId)) {
    throw new BadRequestError('origen_tipo y origen_id deben venir juntos');
  }
  if (origenTipo && !UBICACIONES_VALIDAS.includes(origenTipo)) {
    throw new BadRequestError('origen_tipo debe ser almacen o tienda');
  }

  const productoId = productoPublicId
    ? await resolverProductoId(productoPublicId, req.user.empresa_id)
    : null;
  const ubicacionId = origenTipo
    ? await resolverOrigenId(origenTipo, validarUUID(origenId), req.user.empresa_id)
    : null;

  return { fecha, productoId, ubicacionTipo: origenTipo ?? null, ubicacionId };
};

// v_historial_stock no tiene FK fisica en ubicacion_id (polimorfico, ver
// bd/schema/views/v_historial_stock.sql) -- se resuelve a public_id/nombre
// acá con el mismo patron LEFT JOIN doble que en movimiento.js.
export const historialStock = async (req, res) => {
  const productoPublicId = validarUUID(req.params.productoId);
  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [productoPublicId, req.user.empresa_id]
  );
  if (!producto) throw new NotFoundError();

  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT h.tipo, h.ubicacion_tipo,
            COALESCE(a.public_id, t.public_id) AS ubicacion_public_id,
            COALESCE(a.nombre, t.nombre) AS ubicacion_nombre,
            h.cantidad, h.fecha_creacion, h.motivo,
            COUNT(*) OVER() AS _total
     FROM v_historial_stock h
     LEFT JOIN S_almacenes a ON a.id = h.ubicacion_id AND h.ubicacion_tipo = 'almacen'
     LEFT JOIN S_tiendas   t ON t.id = h.ubicacion_id AND h.ubicacion_tipo = 'tienda'
     WHERE h.empresa_id = $1 AND h.producto_id = $2
     ORDER BY h.fecha_creacion DESC
     LIMIT $3 OFFSET $4`,
    [req.user.empresa_id, producto.id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: HistorialStockNormalizador.normalizarLista(data), meta });
};

// "Mas vendido" agrega directo de S_venta_detalle, NUNCA de v_historial_stock
// -- mezclar merma/traspaso con venta en un ranking de ventas seria un bug
// de reporte (ver design doc).
export const masVendidos = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT p.public_id AS producto_public_id, p.nombre AS producto_nombre,
            SUM(vd.cantidad) AS cantidad_vendida, SUM(vd.subtotal) AS total_vendido,
            COUNT(*) OVER() AS _total
     FROM S_venta_detalle vd
     JOIN S_ventas v ON v.id = vd.venta_id
     JOIN S_productos p ON p.id = vd.producto_id
     WHERE v.empresa_id = $1
     GROUP BY p.public_id, p.nombre
     ORDER BY cantidad_vendida DESC
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: MasVendidoNormalizador.normalizarLista(data), meta });
};

// Listado bruto de trazabilidad (salida/traspaso/venta) por dia, multi-producto
// -- distinto de historialStock (que es por un solo producto). No reemplaza
// ese endpoint, ver design doc.
export const trazabilidad = async (req, res) => {
  const { fecha, productoId, ubicacionTipo, ubicacionId } = await resolverFiltrosTrazabilidad(req);
  const { page, limit, offset } = paginar(req.query);

  const { rows } = await db.query(
    `SELECT h.tipo, p.public_id AS producto_public_id, h.producto_nombre,
            h.ubicacion_tipo, COALESCE(a.public_id, t.public_id) AS ubicacion_public_id,
            h.ubicacion_nombre, h.cantidad, h.fecha_creacion, h.motivo,
            COUNT(*) OVER() AS _total
     ${FROM_TRAZABILIDAD}
     ${WHERE_TRAZABILIDAD}
     ORDER BY h.fecha_creacion DESC
     LIMIT $6 OFFSET $7`,
    [req.user.empresa_id, fecha, productoId, ubicacionTipo, ubicacionId, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: TrazabilidadNormalizador.normalizarLista(data), meta });
};

// Mismo filtro que trazabilidad, agrupado por producto+ubicacion, sin separar
// por tipo (suma unica de salida/traspaso/venta -- decision explicita del
// usuario, ver design doc).
export const trazabilidadResumen = async (req, res) => {
  const { fecha, productoId, ubicacionTipo, ubicacionId } = await resolverFiltrosTrazabilidad(req);
  const { page, limit, offset } = paginar(req.query);

  const { rows } = await db.query(
    `SELECT p.public_id AS producto_public_id, h.producto_nombre,
            h.ubicacion_tipo, COALESCE(a.public_id, t.public_id) AS ubicacion_public_id,
            h.ubicacion_nombre, SUM(h.cantidad) AS cantidad_total,
            COUNT(*) OVER() AS _total
     ${FROM_TRAZABILIDAD}
     ${WHERE_TRAZABILIDAD}
     GROUP BY p.public_id, h.producto_nombre, h.ubicacion_tipo,
              COALESCE(a.public_id, t.public_id), h.ubicacion_nombre
     ORDER BY cantidad_total DESC
     LIMIT $6 OFFSET $7`,
    [req.user.empresa_id, fecha, productoId, ubicacionTipo, ubicacionId, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: TrazabilidadResumenNormalizador.normalizarLista(data), meta });
};
