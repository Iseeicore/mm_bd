import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlVenta from '../../controllers/venta.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('ventas.read'),   manejoErrores(ctrlVenta.getAll));
router.get('/:id', requireAuth, requirePermiso('ventas.read'),   manejoErrores(ctrlVenta.getById));
router.post('/',   requireAuth, requirePermiso('ventas.create'), manejoErrores(ctrlVenta.create));

export default router;
