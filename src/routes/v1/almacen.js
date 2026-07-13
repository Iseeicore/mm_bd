import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlAlmacen from '../../controllers/almacen.js';
import * as ctrlStock from '../../controllers/stockProducto.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('almacenes.read'),   manejoErrores(ctrlAlmacen.getAll));
router.get('/:id', requireAuth, requirePermiso('almacenes.read'),   manejoErrores(ctrlAlmacen.getById));
router.post('/',   requireAuth, requirePermiso('almacenes.create'), manejoErrores(ctrlAlmacen.create));
router.put('/:id', requireAuth, requirePermiso('almacenes.update'), manejoErrores(ctrlAlmacen.update));
router.delete('/:id', requireAuth, requirePermiso('almacenes.delete'), manejoErrores(ctrlAlmacen.remove));

// Inversa de GET /productos/:id/stock (Fase 1) -- que productos hay en este almacen.
router.get('/:id/productos',            requireAuth, requirePermiso('almacenes.read'), manejoErrores(ctrlStock.listarProductosAlmacen));
router.get('/:id/productos/stock-bajo', requireAuth, requirePermiso('almacenes.read'), manejoErrores(ctrlStock.listarProductosAlmacenStockBajo));

export default router;
