import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import db from '../db.js';
import { AppError, BadRequestError, validarUUID } from '../utils/error.js';
import tiempoZona from '../utils/tiempoZona.js';

const COOKIE        = 'token';
const MAX_INTENTOS  = 5;
const BLOQUEO_MIN   = 15;

export const login = async (req, res) => {
  const public_id = validarUUID(req.params.public_id);
  const { email, password } = req.body;

  const { rows: [empresa] } = await db.query(
    'SELECT id FROM S_empresa WHERE public_id = $1 AND activo = TRUE',
    [public_id]
  );
  if (!empresa) throw new AppError('Empresa no encontrada', 404);

  const { rows: [usuario] } = await db.query(
    `SELECT id, empresa_id, email, password_hash, intentos_fallidos, bloqueado_hasta
     FROM S_usuarios
     WHERE email = $1 AND empresa_id = $2 AND activo = TRUE`,
    [email, empresa.id]
  );

  if (!usuario) throw new AppError('Credenciales invalidas', 401);

  if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > new Date()) {
    throw new AppError(
      `Cuenta bloqueada hasta las ${tiempoZona.peru(usuario.bloqueado_hasta)} (hora Perú). Demasiados intentos fallidos.`,
      401
    );
  }

  const valid = await bcrypt.compare(password, usuario.password_hash);

  if (!valid) {
    const nuevos_intentos = usuario.intentos_fallidos + 1;
    const bloquear        = nuevos_intentos >= MAX_INTENTOS;

    await db.query(
      `UPDATE S_usuarios
       SET intentos_fallidos = $1,
           bloqueado_hasta   = CASE WHEN $2 THEN NOW() + INTERVAL '${BLOQUEO_MIN} minutes' ELSE bloqueado_hasta END
       WHERE id = $3`,
      [nuevos_intentos, bloquear, usuario.id]
    );

    if (bloquear) {
      const desbloqueaEn = new Date(Date.now() + BLOQUEO_MIN * 60 * 1000);
      throw new AppError(
        `Cuenta bloqueada hasta las ${tiempoZona.peru(desbloqueaEn)} (hora Perú). Demasiados intentos fallidos.`,
        401
      );
    }

    throw new AppError('Credenciales invalidas', 401);
  }

  await db.query(
    `UPDATE S_usuarios
     SET intentos_fallidos = 0, bloqueado_hasta = NULL, ultimo_acceso = NOW()
     WHERE id = $1`,
    [usuario.id]
  );

  const token = jwt.sign(
    { id: usuario.id, empresa_id: usuario.empresa_id, email: usuario.email },
    process.env.JWT_SECRET,
    { expiresIn: '8h' }
  );

  res.cookie(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 8 * 60 * 60 * 1000,
  });

  res.json({ ok: true });
};

export const logout = (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
};

// Un mismo email puede existir en varias empresas (UNIQUE es por empresa, no
// global) — el login necesita saber a cuál empresa apuntar antes de validar
// la contraseña, porque esa se valida por empresa (empresa_id en la URL).
export const empresasPorEmail = async (req, res) => {
  const { email } = req.query;
  if (!email) throw new BadRequestError('Se requiere email');

  const { rows } = await db.query(
    `SELECT e.public_id, e.nombre
     FROM S_usuarios u
     JOIN S_empresa e ON e.id = u.empresa_id
     WHERE u.email = $1 AND u.activo = TRUE AND e.activo = TRUE
     ORDER BY e.nombre`,
    [email]
  );

  res.json(rows);
};

export const me = async (req, res) => {
  const { rows: [usuario] } = await db.query(
    'SELECT nombre, email FROM S_usuarios WHERE id = $1 AND activo = TRUE',
    [req.user.id]
  );
  if (!usuario) throw new AppError('Usuario no encontrado', 404);

  const { rows: permisos } = await db.query('SELECT clave FROM get_matriz_permisos($1)', [req.user.id]);

  res.json({ nombre: usuario.nombre, email: usuario.email, permisos: permisos.map((p) => p.clave) });
};

export const cambiarPassword = async (req, res) => {
  const { password_actual, password_nueva } = req.body;

  if (!password_actual || !password_nueva) throw new BadRequestError('Se requieren password_actual y password_nueva');
  if (password_nueva.length < 8) throw new BadRequestError('La nueva contraseña debe tener al menos 8 caracteres');
  if (password_actual === password_nueva) throw new BadRequestError('La nueva contraseña debe ser diferente a la actual');

  const { rows: [usuario] } = await db.query(
    'SELECT password_hash FROM S_usuarios WHERE id = $1 AND activo = TRUE',
    [req.user.id]
  );

  const valid = await bcrypt.compare(password_actual, usuario.password_hash);
  if (!valid) throw new AppError('Contraseña actual incorrecta', 401);

  const hash = await bcrypt.hash(password_nueva, 12);

  await db.query(
    `UPDATE S_usuarios
     SET password_hash = $1, fecha_modificacion = NOW(), modificado_por = $2
     WHERE id = $3`,
    [hash, req.user.id, req.user.id]
  );

  res.clearCookie(COOKIE);
  res.json({ ok: true, mensaje: 'Contraseña actualizada. Iniciá sesión de nuevo.' });
};
