import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermiso } from '../../middleware/permiso.js';
import * as ctrlUsuario from '../../controllers/usuario.js';

const router = Router();

router.get('/', requireAuth, requirePermiso('usuarios.read'), manejoErrores(ctrlUsuario.getAll));
router.get('/:id', requireAuth, requirePermiso('usuarios.read'), manejoErrores(ctrlUsuario.getById));
router.post('/', requireAuth, requirePermiso('usuarios.create'), manejoErrores(ctrlUsuario.create));
router.put('/:id', requireAuth, requirePermiso('usuarios.update'), manejoErrores(ctrlUsuario.update));
router.delete('/:id', requireAuth, requirePermiso('usuarios.delete'), manejoErrores(ctrlUsuario.remove));
router.post('/:id/desbloquear',   requireAuth, requirePermiso('usuarios.update'), manejoErrores(ctrlUsuario.desbloquear));
router.get('/:id/roles',          requireAuth, requirePermiso('usuarios.read'),   manejoErrores(ctrlUsuario.getRoles));
router.post('/:id/roles',         requireAuth, requirePermiso('roles.assign'),    manejoErrores(ctrlUsuario.asignarRol));
router.delete('/:id/roles/:rol_id', requireAuth, requirePermiso('roles.assign'), manejoErrores(ctrlUsuario.removerRol));

export default router;
