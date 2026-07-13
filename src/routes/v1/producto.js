import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlProducto from '../../controllers/producto.js';
import * as ctrlStock from '../../controllers/stockProducto.js';
import * as ctrlHistorial from '../../controllers/historialPrecioProducto.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('productos.read'),   manejoErrores(ctrlProducto.getAll));
router.get('/:id', requireAuth, requirePermiso('productos.read'),   manejoErrores(ctrlProducto.getById));
router.post('/',   requireAuth, requirePermiso('productos.create'), manejoErrores(ctrlProducto.create));
router.put('/:id', requireAuth, requirePermiso('productos.update'), manejoErrores(ctrlProducto.update));
router.patch('/:id/precio', requireAuth, requirePermiso('productos.adjust_price'), manejoErrores(ctrlProducto.ajustarPrecio));
router.delete('/:id', requireAuth, requirePermiso('productos.delete'), manejoErrores(ctrlProducto.remove));

// Sin permiso propio de stock (no existe en S_permisos todavía) — sigue el
// mismo criterio read/write que el resto de productos: GET con
// productos.read, escritura con productos.update.
router.get('/:id/stock', requireAuth, requirePermiso('productos.read'), manejoErrores(ctrlStock.obtenerStock));
router.put('/:id/stock/almacenes/:almacenId', requireAuth, requirePermiso('productos.update'), manejoErrores(ctrlStock.actualizarStockAlmacen));
router.put('/:id/stock/tiendas/:tiendaId', requireAuth, requirePermiso('productos.update'), manejoErrores(ctrlStock.actualizarStockTienda));

router.get('/:id/historial-precios', requireAuth, requirePermiso('productos.read'), manejoErrores(ctrlHistorial.obtenerHistorialPrecios));

export default router;
