import db from '../db.js';
import { NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { HistorialStockNormalizador } from '../normalizers/historialStockNormalizador.js';
import { MasVendidoNormalizador } from '../normalizers/masVendidoNormalizador.js';

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
