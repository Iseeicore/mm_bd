import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlTienda from '../../controllers/tienda.js';
import * as ctrlStock from '../../controllers/stockProducto.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('tiendas.read'),   manejoErrores(ctrlTienda.getAll));
router.get('/:id', requireAuth, requirePermiso('tiendas.read'),   manejoErrores(ctrlTienda.getById));
router.post('/',   requireAuth, requirePermiso('tiendas.create'), manejoErrores(ctrlTienda.create));
router.put('/:id', requireAuth, requirePermiso('tiendas.update'), manejoErrores(ctrlTienda.update));
router.delete('/:id', requireAuth, requirePermiso('tiendas.delete'), manejoErrores(ctrlTienda.remove));

// Inversa de GET /productos/:id/stock (Fase 1) -- que productos hay en esta tienda.
router.get('/:id/productos',            requireAuth, requirePermiso('tiendas.read'), manejoErrores(ctrlStock.listarProductosTienda));
router.get('/:id/productos/stock-bajo', requireAuth, requirePermiso('tiendas.read'), manejoErrores(ctrlStock.listarProductosTiendaStockBajo));

export default router;
