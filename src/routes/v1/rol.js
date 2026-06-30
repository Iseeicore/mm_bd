import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlRol from '../../controllers/rol.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('roles.read'),   manejoErrores(ctrlRol.getAll));
router.get('/:id', requireAuth, requirePermiso('roles.read'),   manejoErrores(ctrlRol.getById));
router.post('/',   requireAuth, requirePermiso('roles.create'), manejoErrores(ctrlRol.create));
router.put('/:id', requireAuth, requirePermiso('roles.update'), manejoErrores(ctrlRol.update));
router.delete('/:id', requireAuth, requirePermiso('roles.delete'), manejoErrores(ctrlRol.remove));

export default router;
