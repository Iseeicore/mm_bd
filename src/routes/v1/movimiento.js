import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlMovimiento from '../../controllers/movimiento.js';

const router = Router();

router.get('/',  requireAuth, requirePermiso('movimientos.read'),   manejoErrores(ctrlMovimiento.getAll));
router.post('/', requireAuth, requirePermiso('movimientos.create'), manejoErrores(ctrlMovimiento.create));

export default router;
