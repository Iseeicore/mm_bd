import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlSistema from '../../controllers/sistema.js';

const router = Router();

router.get('/',       requireAuth, requirePermiso('sistemas.read'),   manejoErrores(ctrlSistema.getAll));
router.get('/:id',   requireAuth, requirePermiso('sistemas.read'),   manejoErrores(ctrlSistema.getById));
router.post('/',     requireAuth, requirePermiso('sistemas.create'), manejoErrores(ctrlSistema.create));
router.put('/:id',   requireAuth, requirePermiso('sistemas.update'), manejoErrores(ctrlSistema.update));
router.delete('/:id',requireAuth, requirePermiso('sistemas.delete'), manejoErrores(ctrlSistema.remove));

export default router;
