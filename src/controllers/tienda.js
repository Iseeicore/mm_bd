import db from '../db.js';
import { NotFoundError, BadRequestError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { TiendaNormalizador } from '../normalizers/tiendaNormalizador.js';

const SELECT_TIENDA = `public_id, nombre, ubicacion, empresa_id, activo, fecha_creacion`;

export const create = async (req, res) => {
  const { nombre, ubicacion } = req.body;
  if (!nombre) throw new BadRequestError('El campo nombre es requerido');

  const { rows } = await db.query(
    `INSERT INTO S_tiendas (empresa_id, nombre, ubicacion, creado_por)
     VALUES ($1,$2,$3,$4)
     RETURNING ${SELECT_TIENDA}`,
    [req.user.empresa_id, nombre, ubicacion ?? null, req.user.id]
  );

  res.status(201).json(new TiendaNormalizador(rows[0]).normalizar());
};

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT ${SELECT_TIENDA}, COUNT(*) OVER() AS _total
     FROM S_tiendas
     WHERE empresa_id = $1 AND activo = TRUE
     ORDER BY nombre
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: TiendaNormalizador.normalizarLista(data), meta });
};

export const getById = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { rows } = await db.query(
    `SELECT ${SELECT_TIENDA}
     FROM S_tiendas
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(new TiendaNormalizador(rows[0]).normalizar());
};

export const update = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { nombre, ubicacion } = req.body;

  if (nombre === undefined && ubicacion === undefined)
    throw new BadRequestError('Se requiere al menos un campo para actualizar');

  const { rows: [tienda] } = await db.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!tienda) throw new NotFoundError();

  const sets = [];
  const vals = [];
  let n = 1;
  if (nombre !== undefined)    { sets.push(`nombre = $${n++}`); vals.push(nombre); }
  if (ubicacion !== undefined) { sets.push(`ubicacion = $${n++}`); vals.push(ubicacion); }
  vals.push(req.user.id, tienda.id);

  const { rows } = await db.query(
    `UPDATE S_tiendas
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING ${SELECT_TIENDA}, fecha_modificacion`,
    vals
  );

  res.json(new TiendaNormalizador(rows[0]).normalizar());
};

export const remove = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [tienda] } = await db.query(
    `SELECT id FROM S_tiendas WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!tienda) throw new NotFoundError();

  // Si la tienda todavía tiene stock, trg_bloquear_desactivacion_tienda_con_stock
  // (BEFORE UPDATE OF activo) rechaza este UPDATE con RAISE EXCEPTION (P0001)
  // — el handler global en src/index.js ya lo traduce a 409.
  await db.query(
    `UPDATE S_tiendas SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1 WHERE id = $2`,
    [req.user.id, tienda.id]
  );

  res.status(204).end();
};
