import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import logger from './utils/logger.js';
import { requestLogger } from './middleware/requestLogger.js';
import { globalLimiter, authLimiter } from './middleware/rateLimiter.js';
import health from './routes/v1/health.js';
import registro from './routes/v1/registro.js';
import auth from './routes/v1/auth.js';
import authGlobal from './routes/v1/authGlobal.js';
import sistema from './routes/v1/sistema.js';
import usuario from './routes/v1/usuario.js';
import rol from './routes/v1/rol.js';
import permiso from './routes/v1/permiso.js';
import configuracion from './routes/v1/configuracion.js';
import producto from './routes/v1/producto.js';
import almacen from './routes/v1/almacen.js';
import tienda from './routes/v1/tienda.js';
import movimiento from './routes/v1/movimiento.js';
import venta from './routes/v1/venta.js';
import reporte from './routes/v1/reporte.js';

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:4200', credentials: true }));
app.use(express.json());
app.use(cookieParser());
app.use(requestLogger);
app.use(globalLimiter);

app.use('/api/v1/health', health);
app.use('/api/v1/registro', authLimiter, registro);
app.use('/api/v1/auth', authLimiter, authGlobal);
app.use('/api/v1/empresas/:public_id/auth', auth);
app.use('/api/v1/sistemas', sistema);
app.use('/api/v1/usuarios', usuario);
app.use('/api/v1/roles', rol);
app.use('/api/v1/permisos', permiso);
app.use('/api/v1/configuraciones', configuracion);
app.use('/api/v1/productos', producto);
app.use('/api/v1/almacenes', almacen);
app.use('/api/v1/tiendas', tienda);
app.use('/api/v1/movimientos', movimiento);
app.use('/api/v1/ventas', venta);
app.use('/api/v1/reportes', reporte);

const DB_CONNECTION_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', '57P01']);

// Traduce el nombre interno del CHECK a un mensaje que un cliente/usuario
// entiende, sin regalar el nombre real de la constraint (ver logger.js: el
// detalle técnico completo -- constraint, detail, stack -- va al log, nunca
// a la respuesta HTTP). Constraint nueva sin mapeo -> mensaje genérico, nunca
// se cae al nombre crudo.
const MENSAJES_CHECK = {
  chk_prod_precios: 'El precio de venta debe ser mayor a 0, el precio de compra no puede ser negativo, y las unidades por paquete deben ser al menos 1.',
  chk_pa_stock_no_negativo: 'No hay stock suficiente en ese almacén para esta operación.',
  chk_pt_stock_no_negativo: 'No hay stock suficiente en esa tienda para esta operación.',
  chk_conf_tema: 'El tema debe ser light, dark o custom.',
  chk_perm_accion: 'La acción del permiso no es válida.',
  chk_mov_tipo: 'El tipo de movimiento debe ser entrada, salida o traspaso.',
  chk_mov_ubicacion_tipo: 'La ubicación debe ser un almacén o una tienda.',
  chk_mov_destino_tipo: 'La ubicación destino debe ser un almacén o una tienda.',
  chk_mov_cantidad: 'La cantidad debe ser mayor a 0.',
  chk_mov_traspaso_destino: 'Un traspaso necesita ubicación destino; los demás tipos de movimiento no la llevan.',
  chk_vta_total: 'El total de la venta no puede ser negativo.',
  chk_vd_cantidad: 'La cantidad de la línea debe ser mayor a 0.',
  chk_vd_precio: 'El precio unitario debe ser mayor a 0.',
  chk_vd_origen_tipo: 'El origen de la línea debe ser un almacén o una tienda.',
};
const MENSAJE_CHECK_GENERICO = 'El valor enviado no cumple una regla de negocio.';

app.use((err, req, res, next) => {
  const contexto = { metodo: req.method, ruta: req.originalUrl, empresa_id: req.user?.empresa_id, usuario_id: req.user?.id };

  if (err.isOperational) {
    // Mensaje ya escrito a mano por el controller (BadRequestError, etc.) --
    // pensado para el cliente desde el origen, no filtra nada interno.
    logger.warn(err.message, { ...contexto, statusCode: err.statusCode });
    return res.status(err.statusCode).json({ error: err.message });
  }
  if (DB_CONNECTION_CODES.has(err.code)) {
    logger.error('Base de datos no disponible', { ...contexto, code: err.code, stack: err.stack });
    return res.status(503).json({ error: 'Servicio no disponible' });
  }
  // P0001 = RAISE EXCEPTION sin SQLSTATE explícito, siempre escrito por un
  // trigger propio (nunca un error interno de Postgres) -- el texto ya está
  // redactado a mano para ser legible por un cliente (ver bd/schema/functions/),
  // seguro relayarlo.
  if (err.code === 'P0001') {
    logger.warn(err.message, { ...contexto, code: err.code });
    return res.status(409).json({ error: err.message });
  }
  // 23514 = CHECK constraint violation -- acá SÍ hay que traducir: err.constraint
  // es un nombre interno de schema, nunca cruza al cliente tal cual.
  if (err.code === '23514') {
    logger.warn('CHECK constraint violado', { ...contexto, constraint: err.constraint, detail: err.detail });
    return res.status(400).json({ error: MENSAJES_CHECK[err.constraint] ?? MENSAJE_CHECK_GENERICO });
  }
  logger.error(err.message, { ...contexto, stack: err.stack, code: err.code });
  res.status(500).json({ error: 'Error interno' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => logger.info(`API corriendo en puerto ${PORT}`));
