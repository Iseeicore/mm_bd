import db from '../db.js';
import { AppError, BadRequestError, NotFoundError, validarUUID } from '../utils/error.js';
import { paginar, respuestaPaginada } from '../utils/paginar.js';
import { ProductoNormalizador } from '../normalizers/productoNormalizador.js';

const CAMPOS_PRECIO = ['precio_compra_paquete', 'precio_venta_unidad', 'precio_venta_paquete'];

const SELECT_PRODUCTO = `public_id, codigo_barras, nombre, descripcion, unidades_por_paquete,
            precio_compra_paquete, precio_venta_unidad, precio_venta_paquete,
            empresa_id, activo, fecha_creacion`;

export const create = async (req, res) => {
  const {
    nombre, codigo_barras, descripcion,
    unidades_por_paquete = 1,
    precio_compra_paquete = 0,
    precio_venta_unidad,
    precio_venta_paquete,
  } = req.body;

  if (!nombre) throw new BadRequestError('El campo nombre es requerido');
  if (precio_venta_unidad === undefined) throw new BadRequestError('El campo precio_venta_unidad es requerido');

  const { rows } = await db.query(
    `INSERT INTO S_productos
       (empresa_id, codigo_barras, nombre, descripcion, unidades_por_paquete,
        precio_compra_paquete, precio_venta_unidad, precio_venta_paquete, creado_por)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     ON CONFLICT (empresa_id, codigo_barras) WHERE codigo_barras IS NOT NULL DO NOTHING
     RETURNING ${SELECT_PRODUCTO}`,
    [req.user.empresa_id, codigo_barras ?? null, nombre, descripcion ?? null,
     unidades_por_paquete, precio_compra_paquete, precio_venta_unidad, precio_venta_paquete ?? null,
     req.user.id]
  );

  if (!rows.length) throw new AppError('Ya existe un producto con ese código de barras en esta empresa', 409);
  res.status(201).json(new ProductoNormalizador(rows[0]).normalizar());
};

export const getAll = async (req, res) => {
  const { page, limit, offset } = paginar(req.query);
  const { rows } = await db.query(
    `SELECT ${SELECT_PRODUCTO}, COUNT(*) OVER() AS _total
     FROM S_productos
     WHERE empresa_id = $1 AND activo = TRUE
     ORDER BY nombre
     LIMIT $2 OFFSET $3`,
    [req.user.empresa_id, limit, offset]
  );
  const { data, meta } = respuestaPaginada(rows, page, limit);
  res.json({ data: ProductoNormalizador.normalizarLista(data), meta });
};

export const getById = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { rows } = await db.query(
    `SELECT ${SELECT_PRODUCTO}
     FROM S_productos
     WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!rows.length) throw new NotFoundError();
  res.json(new ProductoNormalizador(rows[0]).normalizar());
};

// El precio se cambia solo por PATCH /productos/:id/precio (permiso
// productos.adjust_price, separado de productos.update) — este endpoint
// rechaza los 3 campos de precio para que esa separación de permisos sea real.
export const update = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { nombre, codigo_barras, descripcion, unidades_por_paquete } = req.body;

  if (CAMPOS_PRECIO.some((campo) => req.body[campo] !== undefined))
    throw new BadRequestError('El precio se modifica con PATCH /productos/:id/precio, no con este endpoint');

  if ([nombre, codigo_barras, descripcion, unidades_por_paquete].every((v) => v === undefined))
    throw new BadRequestError('Se requiere al menos un campo para actualizar');

  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!producto) throw new NotFoundError();

  if (codigo_barras) {
    const { rows: [conflicto] } = await db.query(
      `SELECT id FROM S_productos
       WHERE codigo_barras = $1 AND empresa_id = $2 AND id <> $3 AND activo = TRUE`,
      [codigo_barras, req.user.empresa_id, producto.id]
    );
    if (conflicto) throw new AppError('Ya existe un producto con ese código de barras en esta empresa', 409);
  }

  const sets = [];
  const vals = [];
  let n = 1;
  if (nombre !== undefined)               { sets.push(`nombre = $${n++}`); vals.push(nombre); }
  if (codigo_barras !== undefined)        { sets.push(`codigo_barras = $${n++}`); vals.push(codigo_barras); }
  if (descripcion !== undefined)          { sets.push(`descripcion = $${n++}`); vals.push(descripcion); }
  if (unidades_por_paquete !== undefined) { sets.push(`unidades_por_paquete = $${n++}`); vals.push(unidades_por_paquete); }
  vals.push(req.user.id, producto.id);

  const { rows } = await db.query(
    `UPDATE S_productos
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING ${SELECT_PRODUCTO}, fecha_modificacion`,
    vals
  );

  res.json(new ProductoNormalizador(rows[0]).normalizar());
};

// trg_registrar_historial_precio (AFTER UPDATE OF los 3 campos de precio en
// S_productos) inserta solo en S_producto_historial_precios cuando alguno
// cambia — este endpoint no duplica ese INSERT, solo hace el UPDATE.
export const ajustarPrecio = async (req, res) => {
  const public_id = validarUUID(req.params.id);
  const { precio_compra_paquete, precio_venta_unidad, precio_venta_paquete } = req.body;

  if ([precio_compra_paquete, precio_venta_unidad, precio_venta_paquete].every((v) => v === undefined))
    throw new BadRequestError('Se requiere al menos un campo de precio para actualizar');

  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!producto) throw new NotFoundError();

  const sets = [];
  const vals = [];
  let n = 1;
  if (precio_compra_paquete !== undefined) { sets.push(`precio_compra_paquete = $${n++}`); vals.push(precio_compra_paquete); }
  if (precio_venta_unidad !== undefined)   { sets.push(`precio_venta_unidad = $${n++}`); vals.push(precio_venta_unidad); }
  if (precio_venta_paquete !== undefined)  { sets.push(`precio_venta_paquete = $${n++}`); vals.push(precio_venta_paquete); }
  vals.push(req.user.id, producto.id);

  const { rows } = await db.query(
    `UPDATE S_productos
     SET ${sets.join(', ')}, fecha_modificacion = NOW(), modificado_por = $${n++}
     WHERE id = $${n}
     RETURNING ${SELECT_PRODUCTO}, fecha_modificacion`,
    vals
  );

  res.json(new ProductoNormalizador(rows[0]).normalizar());
};

export const remove = async (req, res) => {
  const public_id = validarUUID(req.params.id);

  const { rows: [producto] } = await db.query(
    `SELECT id FROM S_productos WHERE public_id = $1 AND empresa_id = $2 AND activo = TRUE`,
    [public_id, req.user.empresa_id]
  );
  if (!producto) throw new NotFoundError();

  // Si el producto todavía tiene stock, trg_bloquear_desactivacion_con_stock
  // (BEFORE UPDATE OF activo) rechaza este UPDATE con un RAISE EXCEPTION
  // (SQLSTATE P0001) — el handler global en src/index.js lo traduce a 409.
  await db.query(
    `UPDATE S_productos
     SET activo = FALSE, fecha_modificacion = NOW(), modificado_por = $1
     WHERE id = $2`,
    [req.user.id, producto.id]
  );

  res.status(204).end();
};
