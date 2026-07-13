import db from '../db.js';
import { NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { HistorialPrecioNormalizador } from '../normalizers/historialPrecioNormalizador.js';

// Solo lectura: el INSERT lo hace trg_registrar_historial_precio (AFTER
// UPDATE OF los 3 campos de precio en S_productos), no hay create/update/remove.
export const obtenerHistorialPrecios = async (req, res) => {
  const productoPublicId = validarUUID(req.params.id);

  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [productoPublicId, req.user.empresa_id]
  );
  if (!producto) throw new NotFoundError();

  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    // modificado_por_nombre en vez de exponer el id numérico interno del
    // usuario (chk de api-conventions: nunca exponer el id, solo public_id).
    `SELECT h.precio_compra_paquete_anterior, h.precio_compra_paquete_nuevo,
            h.precio_venta_unidad_anterior, h.precio_venta_unidad_nuevo,
            h.precio_venta_paquete_anterior, h.precio_venta_paquete_nuevo,
            h.fecha_cambio, u.nombre AS modificado_por_nombre,
            COUNT(*) OVER() AS _total
     FROM S_producto_historial_precios h
     JOIN S_usuarios u ON u.id = h.modificado_por
     WHERE h.producto_id = $1
     ORDER BY h.fecha_cambio DESC
     LIMIT $2 OFFSET $3`,
    [producto.id, limit, offset]
  );

  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: HistorialPrecioNormalizador.normalizarLista(data), meta });
};
