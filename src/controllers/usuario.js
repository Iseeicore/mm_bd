import bcrypt from 'bcryptjs';
import db from '../db.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT public_id, nombre, email, empresa_id, activo, fecha_creacion,
            COUNT(*) OVER() AS _total
     FROM S_usuarios
     WHERE empresa_id = $1 AND activo = TRUE
     ORDER BY id
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  res.json(respuestaPaginada(rows, page, limit));
};

export const getById = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { rows } = await db.query(
    `SELECT public_id, nombre, email, empresa_id, activo, fecha_creacion
     FROM S_usuarios
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(rows[0]);
};

export const create = async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) throw new BadRequestError('Faltan campos requeridos');

  const hash = await bcrypt.hash(password, 12);

  const { rows } = await db.query(
    `INSERT INTO S_usuarios (empresa_id, nombre, email, password_hash, creado_por)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (email, empresa_id) WHERE activo = TRUE DO NOTHING
     RETURNING public_id, empresa_id, nombre, email, activo, fecha_creacion`,
    [req.user.empresa_id, nombre, email, hash, req.user.id]
  );

  if (!rows.length) throw new AppError('Email ya registrado en este sistema', 409);
  res.status(201).json(rows[0]);
};

export const update = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { nombre, email } = req.body;

  if (!nombre && !email) throw new BadRequestError('Se requiere al menos nombre o email');

  const { rows: [usuario] } = await db.query(
    `SELECT id FROM S_usuarios
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!usuario) throw new NotFoundError();

  if (email) {
    const { rows: [conflicto] } = await db.query(
      `SELECT id FROM S_usuarios
       WHERE email = $1 AND empresa_id = $2 AND id <> $3 AND activo = TRUE`,
      [email, req.user.empresa_id, usuario.id]
    );
    if (conflicto) throw new AppError('Email ya registrado en este sistema', 409);
  }

  const sets = [];
  const vals = [];
  let n = 1;
  if (nombre) { sets.push(`nombre = $${n++}`); vals.push(nombre); }
  if (email)  { sets.push(`email  = $${n++}`); vals.push(email); }
  vals.push(req.user.id, usuario.id);

  const { rows } = await db.query(
    `UPDATE S_usuarios
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING public_id, nombre, email, empresa_id, activo, fecha_creacion, fecha_modificacion`,
    vals
  );

  res.json(rows[0]);
};

export const remove = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [usuario] } = await db.query(
    `SELECT u.id,
            EXISTS (
              SELECT 1 FROM S_empresa e
              WHERE e.creado_por = u.id AND e.id = u.empresa_id
            ) AS es_creador
     FROM S_usuarios u
     WHERE u.public_id = $1 AND u.empresa_id = $2 AND u.activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!usuario) throw new NotFoundError();
  if (usuario.es_creador) throw new ForbiddenError('No se puede eliminar al creador de la empresa');

  await db.query(
    `UPDATE S_usuarios
     SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1
     WHERE id = $2`,
    [req.user.id, usuario.id]
  );

  res.status(204).end();
};

export const desbloquear = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [usuario] } = await db.query(
    `SELECT id, bloqueado_hasta FROM S_usuarios
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!usuario) throw new NotFoundError();

  if (!usuario.bloqueado_hasta) {
    return res.json({ ok: true, mensaje: 'El usuario no estaba bloqueado' });
  }

  await db.query(
    `UPDATE S_usuarios
     SET intentos_fallidos = 0, bloqueado_hasta = NULL,
         fecha_modificacion = NOW(), modificado_por = $1
     WHERE id = $2`,
    [req.user.id, usuario.id]
  );

  res.json({ ok: true, mensaje: 'Usuario desbloqueado correctamente' });
};

export const asignarRol = async (req, res) => {
  const user_public_id = validarUUID(req.params.id);
  const { rol_id: rol_public_id } = req.body;

  if (!rol_public_id) throw new BadRequestError('Se requiere rol_id');
  validarUUID(rol_public_id);

  const { rows: [usuario] } = await db.query(
    `SELECT id FROM S_usuarios
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [user_public_id, req.user.empresa_id]
  );
  if (!usuario) throw new NotFoundError();

  const { rows: [rol] } = await db.query(
    `SELECT id FROM S_roles
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [rol_public_id, req.user.empresa_id]
  );
  if (!rol) throw new NotFoundError('Rol no encontrado');

  await db.query(
    `INSERT INTO S_usuarios_roles (usuario_id, rol_id, asignado_por)
     VALUES ($1, $2, $3)
     ON CONFLICT (usuario_id, rol_id) DO NOTHING`,
    [usuario.id, rol.id, req.user.id]
  );

  const { rows } = await db.query(
    `SELECT r.public_id, r.nombre, r.descripcion, r.es_default, r.fecha_creacion
     FROM S_roles r
     JOIN S_usuarios_roles ur ON ur.rol_id = r.id
     WHERE ur.usuario_id = $1 AND r.empresa_id = $2 AND r.activo = TRUE
     ORDER BY r.nombre`,
    [usuario.id, req.user.empresa_id]
  );

  res.json(rows);
};

export const removerRol = async (req, res) => {
  const user_public_id = validarUUID(req.params.id);
  const rol_public_id  = validarUUID(req.params.rol_id);

  const { rows: [usuario] } = await db.query(
    `SELECT id FROM S_usuarios
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [user_public_id, req.user.empresa_id]
  );
  if (!usuario) throw new NotFoundError();

  const { rows: [rol] } = await db.query(
    `SELECT id FROM S_roles
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [rol_public_id, req.user.empresa_id]
  );
  if (!rol) throw new NotFoundError('Rol no encontrado');

  const { rowCount } = await db.query(
    `DELETE FROM S_usuarios_roles WHERE usuario_id = $1 AND rol_id = $2`,
    [usuario.id, rol.id]
  );

  if (!rowCount) throw new NotFoundError('El usuario no tiene ese rol asignado');

  res.status(204).end();
};

export const getRoles = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [usuario] } = await db.query(
    `SELECT id FROM S_usuarios
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!usuario) throw new NotFoundError();

  const { rows } = await db.query(
    `SELECT r.public_id, r.nombre, r.descripcion, r.es_default, r.fecha_creacion
     FROM S_roles r
     JOIN S_usuarios_roles ur ON ur.rol_id = r.id
     WHERE ur.usuario_id = $1 AND r.empresa_id = $2 AND r.activo = TRUE
     ORDER BY r.nombre`,
    [usuario.id, req.user.empresa_id]
  );

  res.json(rows);
};
