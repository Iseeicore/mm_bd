import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import * as ctrlPermiso from '../../controllers/permiso.js';

const router = Router();

router.get('/', requireAuth, manejoErrores(ctrlPermiso.getAll));
router.get('/:clave', requireAuth, manejoErrores(ctrlPermiso.getById));

export default router;
