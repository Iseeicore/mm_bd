import db from '../db.js';
import { AppError, BadRequestError, ForbiddenError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';

export const create = async (req, res) => {
  const { nombre, descripcion, es_default = false } = req.body;

  if (!nombre) throw new BadRequestError('El campo nombre es requerido');

  const { rows } = await db.query(
    `INSERT INTO S_roles (empresa_id, nombre, descripcion, es_default, creado_por)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (empresa_id, nombre) WHERE activo = TRUE DO NOTHING
     RETURNING public_id, nombre, descripcion, es_default, empresa_id, activo, fecha_creacion`,
    [req.user.empresa_id, nombre, descripcion ?? null, es_default, req.user.id]
  );

  if (!rows.length) throw new AppError('Ya existe un rol con ese nombre en esta empresa', 409);
  res.status(201).json(rows[0]);
};

export const update = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { nombre, descripcion, es_default } = req.body;

  if (nombre === undefined && descripcion === undefined && es_default === undefined)
    throw new BadRequestError('Se requiere al menos un campo para actualizar');

  const { rows: [rol] } = await db.query(
    `SELECT id FROM S_roles
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rol) throw new NotFoundError();

  if (nombre) {
    const { rows: [conflicto] } = await db.query(
      `SELECT id FROM S_roles
       WHERE nombre = $1 AND empresa_id = $2 AND id <> $3 AND activo = TRUE`,
      [nombre, req.user.empresa_id, rol.id]
    );
    if (conflicto) throw new AppError('Ya existe un rol con ese nombre en esta empresa', 409);
  }

  const sets = [];
  const vals = [];
  let n = 1;
  if (nombre !== undefined)     { sets.push(`nombre     = $${n++}`); vals.push(nombre); }
  if (descripcion !== undefined){ sets.push(`descripcion = $${n++}`); vals.push(descripcion); }
  if (es_default !== undefined) { sets.push(`es_default  = $${n++}`); vals.push(es_default); }
  vals.push(req.user.id, rol.id);

  const { rows } = await db.query(
    `UPDATE S_roles
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING public_id, nombre, descripcion, es_default, empresa_id, activo, fecha_creacion, fecha_modificacion`,
    vals
  );

  res.json(rows[0]);
};

export const remove = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [rol] } = await db.query(
    `SELECT id, es_default FROM S_roles
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rol) throw new NotFoundError();
  if (rol.es_default) throw new ForbiddenError('No se puede eliminar el rol por defecto de la empresa');

  await db.query(
    `UPDATE S_roles
     SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1
     WHERE id = $2`,
    [req.user.id, rol.id]
  );

  res.status(204).end();
};

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT public_id, nombre, descripcion, es_default, empresa_id, activo, fecha_creacion,
            COUNT(*) OVER() AS _total
     FROM S_roles
     WHERE empresa_id = $1 AND activo = TRUE
     ORDER BY nombre
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  res.json(respuestaPaginada(rows, page, limit));
};

export const getById = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { rows } = await db.query(
    `SELECT public_id, nombre, descripcion, es_default, empresa_id, activo, fecha_creacion
     FROM S_roles
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(rows[0]);
};
