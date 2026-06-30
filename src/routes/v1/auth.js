import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import * as ctrlAuth from '../../controllers/auth.js';

const router = Router({ mergeParams: true });

router.post('/login',    manejoErrores(ctrlAuth.login));
router.post('/logout',   ctrlAuth.logout);
router.put('/password',  requireAuth, manejoErrores(ctrlAuth.cambiarPassword));

export default router;
