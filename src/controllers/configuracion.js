import db from '../db.js';
import { BadRequestError, ForbiddenError, NotFoundError, validarId, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT c.id, c.sistema_id, c.color_primario, c.color_secundario, c.color_acento,
            c.color_texto, c.color_fondo, c.tema, c.es_activa, c.activo, c.fecha_creacion,
            COUNT(*) OVER() AS _total
     FROM S_configuraciones c
     JOIN S_sistema s ON s.id = c.sistema_id
     WHERE s.empresa_id = $1 AND c.activo = TRUE
     ORDER BY c.id
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  res.json(respuestaPaginada(rows, page, limit));
};

// Sin gate de permiso admin a propósito: cualquier usuario autenticado
// necesita estos colores para pintar su propia UI, no solo quien administra
// sistemas. Asume 1 sistema activo por empresa (así crea registro.js hoy);
// si a futuro una empresa tiene varios, toma el de menor id.
export const getActiva = async (req, res) => {
  const { rows } = await db.query(
    `SELECT c.id, c.sistema_id, c.color_primario, c.color_secundario, c.color_acento,
            c.color_texto, c.color_fondo, c.tema
     FROM S_configuraciones c
     JOIN S_sistema s ON s.id = c.sistema_id
     WHERE s.empresa_id = $1 AND c.es_activa = TRUE AND c.activo = TRUE
     ORDER BY s.id
     LIMIT 1`,
    [req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(rows[0]);
};

export const getById = async (req, res) => {
  const id = validarId(req.params.id);
  const { rows } = await db.query(
    `SELECT c.id, c.sistema_id, c.color_primario, c.color_secundario, c.color_acento,
            c.color_texto, c.color_fondo, c.tema, c.es_activa, c.activo, c.fecha_creacion
     FROM S_configuraciones c
     JOIN S_sistema s ON s.id = c.sistema_id
     WHERE c.id = $1 AND s.empresa_id = $2 AND c.activo = TRUE`,
    [id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(rows[0]);
};

export const create = async (req, res) => {
  const { sistema_public_id, color_primario, color_secundario, color_acento, color_texto, color_fondo, tema } = req.body;

  if (!sistema_public_id || !color_primario || !color_secundario || !color_acento)
    throw new BadRequestError('Faltan campos requeridos: sistema_public_id, color_primario, color_secundario, color_acento');

  const sistema_uuid = validarUUID(sistema_public_id);
  const { rows: [sistema] } = await db.query(
    `SELECT id FROM S_sistema WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [sistema_uuid, req.user.empresa_id]
  );
  if (!sistema) throw new NotFoundError('Sistema no encontrado');

  const { rows: [config] } = await db.query(
    `INSERT INTO S_configuraciones
       (sistema_id, color_primario, color_secundario, color_acento, color_texto, color_fondo, tema, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
     RETURNING id, sistema_id, color_primario, color_secundario, color_acento,
               color_texto, color_fondo, tema, es_activa, activo, fecha_creacion`,
    [
      sistema.id,
      color_primario,
      color_secundario,
      color_acento,
      color_texto  ?? '#1A1A1A',
      color_fondo  ?? '#FFFFFF',
      tema         ?? 'light',
      req.user.id,
    ]
  );

  res.status(201).json(config);
};

export const update = async (req, res) => {
  const id = validarId(req.params.id);
  const { color_primario, color_secundario, color_acento, color_texto, color_fondo, tema, es_activa } = req.body;

  if (!color_primario && !color_secundario && !color_acento && !color_texto && !color_fondo && !tema && es_activa === undefined)
    throw new BadRequestError('Se requiere al menos un campo para actualizar');

  const { rows: [config] } = await db.query(
    `SELECT c.id FROM S_configuraciones c
     JOIN S_sistema s ON s.id = c.sistema_id
     WHERE c.id = $1 AND s.empresa_id = $2 AND c.activo = TRUE`,
    [id, req.user.empresa_id]
  );
  if (!config) throw new NotFoundError();

  const sets = [];
  const vals = [];
  let n = 1;
  if (color_primario)   { sets.push(`color_primario   = $${n++}`); vals.push(color_primario); }
  if (color_secundario) { sets.push(`color_secundario = $${n++}`); vals.push(color_secundario); }
  if (color_acento)     { sets.push(`color_acento     = $${n++}`); vals.push(color_acento); }
  if (color_texto)      { sets.push(`color_texto      = $${n++}`); vals.push(color_texto); }
  if (color_fondo)      { sets.push(`color_fondo      = $${n++}`); vals.push(color_fondo); }
  if (tema)             { sets.push(`tema             = $${n++}`); vals.push(tema); }
  if (es_activa !== undefined) { sets.push(`es_activa = $${n++}`); vals.push(es_activa); }
  vals.push(req.user.id, config.id);

  const { rows } = await db.query(
    `UPDATE S_configuraciones
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING id, sistema_id, color_primario, color_secundario, color_acento,
               color_texto, color_fondo, tema, es_activa, activo, fecha_creacion, fecha_modificacion`,
    vals
  );

  res.json(rows[0]);
};

export const remove = async (req, res) => {
  const id = validarId(req.params.id);

  const { rows: [config] } = await db.query(
    `SELECT c.id, c.es_activa FROM S_configuraciones c
     JOIN S_sistema s ON s.id = c.sistema_id
     WHERE c.id = $1 AND s.empresa_id = $2 AND c.activo = TRUE`,
    [id, req.user.empresa_id]
  );
  if (!config) throw new NotFoundError();
  if (config.es_activa) throw new ForbiddenError('No se puede eliminar la configuracion activa');

  await db.query(
    `UPDATE S_configuraciones SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1 WHERE id = $2`,
    [req.user.id, config.id]
  );

  res.status(204).end();
};
