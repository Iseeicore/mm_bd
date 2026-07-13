import db from '../db.js';
import { NotFoundError, BadRequestError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { AlmacenNormalizador } from '../normalizers/almacenNormalizador.js';

const SELECT_ALMACEN = `public_id, nombre, ubicacion, empresa_id, activo, fecha_creacion`;

export const create = async (req, res) => {
  const { nombre, ubicacion } = req.body;
  if (!nombre) throw new BadRequestError('El campo nombre es requerido');

  const { rows } = await db.query(
    `INSERT INTO S_almacenes (empresa_id, nombre, ubicacion, creado_por)
     VALUES ($1,$2,$3,$4)
     RETURNING ${SELECT_ALMACEN}`,
    [req.user.empresa_id, nombre, ubicacion ?? null, req.user.id]
  );

  res.status(201).json(new AlmacenNormalizador(rows[0]).normalizar());
};

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT ${SELECT_ALMACEN}, COUNT(*) OVER() AS _total
     FROM S_almacenes
     WHERE empresa_id = $1 AND activo = TRUE
     ORDER BY nombre
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: AlmacenNormalizador.normalizarLista(data), meta });
};

export const getById = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { rows } = await db.query(
    `SELECT ${SELECT_ALMACEN}
     FROM S_almacenes
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(new AlmacenNormalizador(rows[0]).normalizar());
};

export const update = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { nombre, ubicacion } = req.body;

  if (nombre === undefined && ubicacion === undefined)
    throw new BadRequestError('Se requiere al menos un campo para actualizar');

  const { rows: [almacen] } = await db.query(
    `SELECT id FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!almacen) throw new NotFoundError();

  const sets = [];
  const vals = [];
  let n = 1;
  if (nombre !== undefined)    { sets.push(`nombre = $${n++}`); vals.push(nombre); }
  if (ubicacion !== undefined) { sets.push(`ubicacion = $${n++}`); vals.push(ubicacion); }
  vals.push(req.user.id, almacen.id);

  const { rows } = await db.query(
    `UPDATE S_almacenes
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING ${SELECT_ALMACEN}, fecha_modificacion`,
    vals
  );

  res.json(new AlmacenNormalizador(rows[0]).normalizar());
};

export const remove = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [almacen] } = await db.query(
    `SELECT id FROM S_almacenes WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!almacen) throw new NotFoundError();

  // Si el almacén todavía tiene stock, trg_bloquear_desactivacion_almacen_con_stock
  // (BEFORE UPDATE OF activo) rechaza este UPDATE con RAISE EXCEPTION (P0001)
  // — el handler global en src/index.js ya lo traduce a 409.
  await db.query(
    `UPDATE S_almacenes SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1 WHERE id = $2`,
    [req.user.id, almacen.id]
  );

  res.status(204).end();
};
