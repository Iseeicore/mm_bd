import { Router } from 'express';
import manejoErrores from './manejoErrores.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import * as ctrlAuth from '../../controllers/auth.js';

const router = Router({ mergeParams: true });

// authLimiter (10/15min) solo en las rutas que verifican una credencial --
// fuerza bruta real. /me y /logout no verifican nada nuevo (ya pasaron por
// requireAuth o ni lo requieren) y quedan cubiertas por el globalLimiter
// blanket de index.js; si no, 3-4 refreshes de página agotan el cupo.
router.post('/login',    authLimiter, manejoErrores(ctrlAuth.login));
router.post('/logout',   ctrlAuth.logout);
router.get('/me',        requireAuth, manejoErrores(ctrlAuth.me));
router.put('/password',  authLimiter, requireAuth, manejoErrores(ctrlAuth.cambiarPassword));

export default router;
