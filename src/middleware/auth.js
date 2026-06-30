import jwt from 'jsonwebtoken';
import { AppError } from '../utils/error.js';

export const requireAuth = (req, res, next) => {
  const token = req.cookies?.token;
  if (!token) return next(new AppError('No autenticado', 401));
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    next(new AppError('Token invalido', 401));
  }
};
