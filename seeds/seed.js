import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const PERMISOS = [
  { modulo: 'sistemas', accion: 'READ',   clave: 'sistemas.read',   descripcion: 'Ver sistemas' },
  { modulo: 'sistemas', accion: 'CREATE', clave: 'sistemas.create', descripcion: 'Crear sistema' },
  { modulo: 'sistemas', accion: 'UPDATE', clave: 'sistemas.update', descripcion: 'Modificar sistema' },
  { modulo: 'sistemas', accion: 'DELETE', clave: 'sistemas.delete', descripcion: 'Desactivar sistema' },
  { modulo: 'usuarios', accion: 'READ',   clave: 'usuarios.read',   descripcion: 'Ver usuarios' },
  { modulo: 'usuarios', accion: 'CREATE', clave: 'usuarios.create', descripcion: 'Crear usuario' },
  { modulo: 'usuarios', accion: 'UPDATE', clave: 'usuarios.update', descripcion: 'Modificar usuario' },
  { modulo: 'usuarios', accion: 'DELETE', clave: 'usuarios.delete', descripcion: 'Desactivar usuario' },
  { modulo: 'roles',    accion: 'READ',   clave: 'roles.read',      descripcion: 'Ver roles' },
  { modulo: 'roles',    accion: 'CREATE', clave: 'roles.create',    descripcion: 'Crear rol' },
  { modulo: 'roles',    accion: 'UPDATE', clave: 'roles.update',    descripcion: 'Modificar rol' },
  { modulo: 'roles',    accion: 'DELETE', clave: 'roles.delete',    descripcion: 'Desactivar rol' },
  { modulo: 'roles',    accion: 'ASSIGN', clave: 'roles.assign',    descripcion: 'Asignar/revocar rol a usuario' },
];

const ROLES_BASE = [
  {
    nombre: 'Administrador',
    descripcion: 'Acceso total al sistema',
    es_default: false,
    permisos: PERMISOS.map(p => p.clave),
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

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const p of PERMISOS) {
      await client.query(
        `INSERT INTO S_permisos (modulo, accion, clave, descripcion)
         VALUES ($1,$2,$3,$4)
         ON CONFLICT (clave) DO NOTHING`,
        [p.modulo, p.accion, p.clave, p.descripcion]
      );
    }

    const { rows: existing } = await client.query(
      `SELECT id FROM S_empresa WHERE ruc = '20000000001'`
    );
    if (existing.length) {
      console.log('La empresa demo ya existe. Seed omitido.');
      await client.query('ROLLBACK');
      return;
    }

    const { rows: [empresa] } = await client.query(
      `INSERT INTO S_empresa (nombre, ruc) VALUES ('Demo Empresa S.A.', '20000000001') RETURNING id, public_id`
    );

    const hash = await bcrypt.hash('Admin1234!', 12);
    const { rows: [usuario] } = await client.query(
      `INSERT INTO S_usuarios (empresa_id, nombre, email, password_hash)
       VALUES ($1, 'Administrador Demo', 'admin@demo.com', $2) RETURNING id`,
      [empresa.id, hash]
    );

    await client.query('UPDATE S_empresa SET creado_por = $1 WHERE id = $2', [usuario.id, empresa.id]);

    let rolAdminId;
    for (const r of ROLES_BASE) {
      const { rows: [rol] } = await client.query(
        `INSERT INTO S_roles (empresa_id, nombre, descripcion, es_default, creado_por) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [empresa.id, r.nombre, r.descripcion, r.es_default, usuario.id]
      );
      await client.query(
        `INSERT INTO S_roles_permisos (rol_id, permiso_id)
         SELECT $1, id FROM S_permisos WHERE clave = ANY($2)`,
        [rol.id, r.permisos]
      );
      if (r.nombre === 'Administrador') rolAdminId = rol.id;
    }

    await client.query(
      `INSERT INTO S_usuarios_roles (usuario_id, rol_id, asignado_por) VALUES ($1,$2,$3)`,
      [usuario.id, rolAdminId, usuario.id]
    );

    await client.query('COMMIT');
    console.log('Seed completado:');
    console.log(`  empresa.public_id : ${empresa.public_id}`);
    console.log(`  email             : admin@demo.com`);
    console.log(`  password          : Admin1234!`);

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error en seed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    pool.end();
  }
}

seed();
