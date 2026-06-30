import db from '../db.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT public_id, nombre_proyecto, empresa_id, db_host, db_puerto, db_nombre, activo, fecha_creacion,
            COUNT(*) OVER() AS _total
     FROM S_sistema
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
    `SELECT public_id, nombre_proyecto, empresa_id, db_host, db_puerto, db_nombre, activo, fecha_creacion
     FROM S_sistema
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(rows[0]);
};

export const create = async (req, res) => {
  const {
    nombre_proyecto,
    db_host,
    db_nombre,
    db_usuario,
    db_password_ref,
    color_background = '#FFFFFF',
    db_puerto = 5432,
    ubicacion = null,
  } = req.body;

  if (!nombre_proyecto || !db_host || !db_nombre || !db_usuario || !db_password_ref)
    throw new BadRequestError('Faltan campos requeridos');

  const { rows: [sistema] } = await db.query(
    `INSERT INTO S_sistema
       (empresa_id, nombre_proyecto, color_background, db_host, db_puerto, db_nombre, db_usuario, db_password_ref, ubicacion, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
     RETURNING public_id, nombre_proyecto, activo, fecha_creacion`,
    [req.user.empresa_id, nombre_proyecto, color_background, db_host, db_puerto, db_nombre, db_usuario, db_password_ref, ubicacion, req.user.id]
  );

  res.status(201).json(sistema);
};

export const update = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { nombre_proyecto, color_background, db_host, db_puerto, db_nombre, db_usuario, db_password_ref, ubicacion } = req.body;

  if (!nombre_proyecto && !color_background && !db_host && !db_puerto && !db_nombre && !db_usuario && !db_password_ref && ubicacion === undefined)
    throw new BadRequestError('Se requiere al menos un campo para actualizar');

  const { rows: [sistema] } = await db.query(
    `SELECT id FROM S_sistema WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!sistema) throw new NotFoundError();

  const sets = [];
  const vals = [];
  let n = 1;
  if (nombre_proyecto)  { sets.push(`nombre_proyecto  = $${n++}`); vals.push(nombre_proyecto); }
  if (color_background) { sets.push(`color_background = $${n++}`); vals.push(color_background); }
  if (db_host)          { sets.push(`db_host          = $${n++}`); vals.push(db_host); }
  if (db_puerto)        { sets.push(`db_puerto        = $${n++}`); vals.push(db_puerto); }
  if (db_nombre)        { sets.push(`db_nombre        = $${n++}`); vals.push(db_nombre); }
  if (db_usuario)       { sets.push(`db_usuario       = $${n++}`); vals.push(db_usuario); }
  if (db_password_ref)  { sets.push(`db_password_ref  = $${n++}`); vals.push(db_password_ref); }
  if (ubicacion !== undefined) { sets.push(`ubicacion = $${n++}`); vals.push(ubicacion); }
  vals.push(req.user.id, sistema.id);

  const { rows } = await db.query(
    `UPDATE S_sistema
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING public_id, nombre_proyecto, db_host, db_puerto, db_nombre, activo, fecha_creacion, fecha_modificacion`,
    vals
  );

  res.json(rows[0]);
};

export const remove = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [sistema] } = await db.query(
    `SELECT id FROM S_sistema WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!sistema) throw new NotFoundError();

  const { rows: [{ total }] } = await db.query(
    `SELECT COUNT(*) AS total FROM S_sistema WHERE empresa_id = $1 AND activo = TRUE`,
    [req.user.empresa_id]
  );
  if (parseInt(total) <= 1) throw new ForbiddenError('No se puede eliminar el unico sistema activo de la empresa');

  await db.query(
    `UPDATE S_sistema SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1 WHERE id = $2`,
    [req.user.id, sistema.id]
  );

  res.status(204).end();
};
