import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { globalLimiter, authLimiter } from './middleware/rateLimiter.js';
import health from './routes/v1/health.js';
import registro from './routes/v1/registro.js';
import auth from './routes/v1/auth.js';
import sistema from './routes/v1/sistema.js';
import usuario from './routes/v1/usuario.js';
import rol from './routes/v1/rol.js';
import permiso from './routes/v1/permiso.js';
import configuracion from './routes/v1/configuracion.js';

const app = express();
app.use(helmet());
app.use(express.json());
app.use(cookieParser());
app.use(globalLimiter);

app.use('/api/v1/health', health);
app.use('/api/v1/registro', authLimiter, registro);
app.use('/api/v1/empresas/:public_id/auth', authLimiter, auth);
app.use('/api/v1/sistemas', sistema);
app.use('/api/v1/usuarios', usuario);
app.use('/api/v1/roles', rol);
app.use('/api/v1/permisos', permiso);
app.use('/api/v1/configuraciones', configuracion);

const DB_CONNECTION_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01']);

app.use((err, req, res, next) => {
  if (err.isOperational) return res.status(err.statusCode).json({ error: err.message });
  if (DB_CONNECTION_CODES.has(err.code)) return res.status(503).json({ error: 'Servicio no disponible' });
  console.error(err.stack);
  res.status(500).json({ error: 'Error interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API corriendo en puerto ${PORT}`));
