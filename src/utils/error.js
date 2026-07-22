export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
  }
}

export class BadRequestError extends AppError {
  constructor(message = 'Bad request') {
    super(message, 400);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'No encontrado') {
    super(message, 404);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Sin permiso') {
    super(message, 403);
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(message = 'Servicio no disponible') {
    super(message, 503);
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

export const validarId = (id) => {
  const num = Number(id);
  if (!Number.isInteger(num) || num <= 0) throw new BadRequestError('ID invalido');
  return num;
};

export const validarUUID = (id) => {
  if (!UUID_RE.test(id)) throw new BadRequestError('ID invalido');
  return id;
};

export const validarFecha = (fecha) => {
  if (!fecha || !FECHA_RE.test(fecha) || Number.isNaN(Date.parse(fecha))) {
    throw new BadRequestError('Fecha invalida, formato esperado YYYY-MM-DD');
  }
  return fecha;
};
