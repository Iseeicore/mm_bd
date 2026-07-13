import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlTienda from '../../controllers/tienda.js';

const router = Router();

router.get('/',    requireAuth, requirePermiso('tiendas.read'),   manejoErrores(ctrlTienda.getAll));
router.get('/:id', requireAuth, requirePermiso('tiendas.read'),   manejoErrores(ctrlTienda.getById));
router.post('/',   requireAuth, requirePermiso('tiendas.create'), manejoErrores(ctrlTienda.create));
router.put('/:id', requireAuth, requirePermiso('tiendas.update'), manejoErrores(ctrlTienda.update));
router.delete('/:id', requireAuth, requirePermiso('tiendas.delete'), manejoErrores(ctrlTienda.remove));

export default router;
