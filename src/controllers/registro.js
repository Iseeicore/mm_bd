import bcrypt from 'bcryptjs';
import db from '../db.js';
import { AppError, BadRequestError } from '../utils/error.js';

const ROLES_BASE = [
  {
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    es_default: false,
    permisos: [
      'sistemas.read', 'sistemas.create', 'sistemas.update', 'sistemas.delete',
      'usuarios.read', 'usuarios.create', 'usuarios.update', 'usuarios.delete',
      'roles.read', 'roles.create', 'roles.update', 'roles.delete', 'roles.assign',
    ],
  },
  {
    nombre: 'Gestor',
    descripcion: 'Gestion de usuarios y roles',
    es_default: false,
    permisos: ['usuarios.read', 'usuarios.create', 'usuarios.update', 'usuarios.delete', 'roles.read', 'roles.assign'],
  },
  {
    nombre: 'Operador',
    descripcion: 'Operaciones basicas de usuario',
    es_default: false,
    permisos: ['usuarios.read', 'usuarios.create', 'usuarios.update'],
  },
  {
    nombre: 'Lector',
    descripcion: 'Solo lectura',
    es_default: true,
    permisos: ['usuarios.read', 'roles.read'],
  },
];

export const registrar = async (req, res) => {
  const { empresa_nombre, empresa_ruc, admin_nombre, admin_email, admin_password } = req.body;

  if (!empresa_nombre || !empresa_ruc || !admin_nombre || !admin_email || !admin_password)
    throw new BadRequestError('Faltan campos requeridos');

  const hash = await bcrypt.hash(admin_password, 12);
  const client = await db.connect();

  try {
    await client.query('BEGIN');

    const { rows: [empresa] } = await client.query(
      'INSERT INTO S_empresa (nombre, ruc) VALUES ($1,$2) RETURNING id, public_id',
      [empresa_nombre, empresa_ruc]
    );

    const { rows: [usuario] } = await client.query(
      'INSERT INTO S_usuarios (empresa_id, nombre, email, password_hash) VALUES ($1,$2,$3,$4) RETURNING id',
      [empresa.id, admin_nombre, admin_email, hash]
    );

    await client.query('UPDATE S_empresa SET creado_por = $1 WHERE id = $2', [usuario.id, empresa.id]);

    let rolAdminId;
    for (const r of ROLES_BASE) {
      const { rows: [rol] } = await client.query(
        'INSERT INTO S_roles (empresa_id, nombre, descripcion, es_default, creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [empresa.id, r.nombre, r.descripcion, r.es_default, usuario.id]
      );
      await client.query(
        'INSERT INTO S_roles_permisos (rol_id, permiso_id) SELECT $1, id FROM S_permisos WHERE clave = ANY($2)',
        [rol.id, r.permisos]
      );
      if (r.nombre === 'Administrador') rolAdminId = rol.id;
    }

    await client.query(
      'INSERT INTO S_usuarios_roles (usuario_id, rol_id, asignado_por) VALUES ($1,$2,$3)',
      [usuario.id, rolAdminId, usuario.id]
    );

    const dbUrl = new URL(process.env.DATABASE_URL);
    const { rows: [sistema] } = await client.query(
      `INSERT INTO S_sistema
         (empresa_id, nombre_proyecto, db_host, db_puerto, db_nombre, db_usuario, db_password_ref, creado_por)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING id`,
      [
        empresa.id,
        empresa_nombre,
        dbUrl.hostname,
        parseInt(dbUrl.port) || 5432,
        dbUrl.pathname.slice(1),
        dbUrl.username,
        'env:DATABASE_URL',
        usuario.id,
      ]
    );

    await client.query(
      `INSERT INTO S_configuraciones
         (sistema_id, color_primario, color_secundario, color_acento, creado_por)
       VALUES ($1,$2,$3,$4,$5)`,
      [sistema.id, '#1976D2', '#424242', '#FF4081', usuario.id]
    );

    await client.query('COMMIT');
    res.status(201).json({ empresa_public_id: empresa.public_id, email: admin_email });

  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') throw new AppError('RUC o email ya registrado', 409);
    throw err;
  } finally {
    client.release();
  }
};
