import logger from '../utils/logger.js';

// Nunca loguea req.body -- puede traer password_actual/password_nueva/admin_password
// (ver registro.js, auth.js) y no hay razón de negocio para guardarlo en el
// historial de logs.
export const requestLogger = (req, res, next) => {
  const inicio = Date.now();
  res.on('finish', () => {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode}`, {
      duracion_ms: Date.now() - inicio,
      empresa_id: req.user?.empresa_id,
      usuario_id: req.user?.id,
    });
  });
  next();
};
