import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlAlmacen from '../../controllers/almacen.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('almacenes.read'),   manejoErrores(ctrlAlmacen.getAll));
router.get('/:id', requireAuth, requirePermiso('almacenes.read'),   manejoErrores(ctrlAlmacen.getById));
router.post('/',   requireAuth, requirePermiso('almacenes.create'), manejoErrores(ctrlAlmacen.create));
router.put('/:id', requireAuth, requirePermiso('almacenes.update'), manejoErrores(ctrlAlmacen.update));
router.delete('/:id', requireAuth, requirePermiso('almacenes.delete'), manejoErrores(ctrlAlmacen.remove));

export default router;
