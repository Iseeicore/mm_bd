import db from '../db.js';
import { ForbiddenError } from '../utils/error.js';

export const requirePermiso = (clave) => (req, res, next) =>
  db.query('SELECT usuario_tiene_permiso($1, $2) AS tiene', [req.user.id, clave])
    .then(({ rows: [{ tiene }] }) => {
      if (!tiene) return next(new ForbiddenError());
      next();
    })
    .catch(next);
