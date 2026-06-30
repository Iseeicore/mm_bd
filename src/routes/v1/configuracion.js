import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlConfig from '../../controllers/configuracion.js';

const router = Router();

router.get('/',      requireAuth, requirePermiso('sistemas.read'),   manejoErrores(ctrlConfig.getAll));
router.get('/:id',   requireAuth, requirePermiso('sistemas.read'),   manejoErrores(ctrlConfig.getById));
router.post('/',     requireAuth, requirePermiso('sistemas.create'), manejoErrores(ctrlConfig.create));
router.put('/:id',   requireAuth, requirePermiso('sistemas.update'), manejoErrores(ctrlConfig.update));
router.delete('/:id',requireAuth, requirePermiso('sistemas.delete'), manejoErrores(ctrlConfig.remove));

export default router;
