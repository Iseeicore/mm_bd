import winston from 'winston';
import 'winston-daily-rotate-file';

const { combine, timestamp, printf, colorize, json, errors } = winston.format;

// Consola: legible en desarrollo. Archivo: JSON estructurado, rotado por día,
// para poder buscar/filtrar el historial real (grep, jq, o un agregador
// externo el día que haga falta) sin depender de una app de observabilidad
// aparte.
const consolaLegible = printf(({ level, message, timestamp, ...meta }) => {
  const extra = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp} [${level}] ${message}${extra}`;
});

const logger = winston.createLogger({
  // 'http' (prioridad 3, por debajo de error/warn/info) para que
  // requestLogger.js pase el filtro -- 'info' como default se comería los
  // logs de request silenciosamente.
  level: process.env.LOG_LEVEL || 'http',
  format: combine(timestamp(), errors({ stack: true }), json()),
  transports: [
    new winston.transports.Console({
      format: combine(colorize(), timestamp(), consolaLegible),
    }),
    new winston.transports.DailyRotateFile({
      dirname: 'logs',
      filename: 'bases-api-%DATE%.log',
      datePattern: 'YYYY-MM-DD',
      maxFiles: '30d',
      maxSize: '20m',
    }),
  ],
});

export default logger;
