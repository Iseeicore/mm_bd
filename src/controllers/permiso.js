import db from '../db.js';
import { NotFoundError } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT modulo, accion, clave, descripcion, activo, fecha_creacion,
            COUNT(*) OVER() AS _total
     FROM S_permisos
     WHERE activo = TRUE
     ORDER BY modulo, accion
     LIMIT $1 OFFSET $2`,
    [limit, offset]
  );
  res.json(respuestaPaginada(rows, page, limit));
};

export const getById = async (req, res) => {
  const { rows } = await db.query(
    `SELECT modulo, accion, clave, descripcion, activo, fecha_creacion
     FROM S_permisos
     WHERE clave = $1 AND activo = TRUE`,
    [req.params.clave]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(rows[0]);
};
