import { rateLimit } from 'express-rate-limit';

export const globalLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  limit:            300,
  standardHeaders:  'draft-8',
  legacyHeaders:    false,
  message:          { error: 'Demasiadas solicitudes. Intentá de nuevo en 15 minutos.' },
});

export const authLimiter = rateLimit({
  windowMs:         15 * 60 * 1000,
  limit:            10,
  standardHeaders:  'draft-8',
  legacyHeaders:    false,
  message:          { error: 'Demasiados intentos. Intentá de nuevo en 15 minutos.' },
});
