import '../config/env.js';

import { db, models } from '../models/index.js';
import { hashPassword } from '../services/authService.js';
import { setRolePreset, setUserPermissions } from '../helpers/permissions.js';
import { bootstrapEntitlementCatalog } from '../services/entitlementCatalogService.js';
import { bootstrapStoreCatalog } from '../services/storeCatalogService.js';

const statuses = [
  ['ACTIVE', 'Activo', true],
  ['INACTIVE', 'Inactivo', true],
  ['LOCKED', 'Bloqueado', true]
];

const roles = [
  ['SUPER_ADMIN', 'Super Admin', true],
  ['ADMIN', 'Admin', true],
  ['USER', 'User', true]
];

const permissions = [
  ['menu.dashboard', 'Ver inicio', 'Permite acceder al inicio de la aplicación.'],
  ['menu.profile', 'Ver perfil', 'Permite acceder al perfil propio.'],
  ['admin.system.access', 'Administración del sistema', 'Permite entrar al panel de administración del sistema.'],
  ['admin.users.read', 'Consultar usuarios', 'Permite consultar usuarios desde la administración del sistema.'],
  ['admin.users.permissions.manage', 'Administrar permisos de usuarios', 'Permite modificar permisos explícitos de otros usuarios.'],
  ['admin.collaborators.read', 'Consultar colaboradores', 'Permite consultar la asignación administrativa de Licencias Collab.'],
  ['admin.collaborators.manage', 'Administrar Licencias Collab', 'Permite asignar y revocar Licencias Collab permanentes.']
];

const settings = [
  ['auth.registration.enabled', 'true', 'Permite el registro público de usuarios.', true]
];

async function seed() {
  await db.authenticate();
  const createdRoleKeys = new Set();

  for (const [key, name, system] of statuses) {
    await models.UserStatus.findOrCreate({ where: { key }, defaults: { name, system, active: true } });
  }

  for (const [key, name, system] of roles) {
    const [, created] = await models.Role.findOrCreate({ where: { key }, defaults: { name, system, active: true } });
    if (created) createdRoleKeys.add(key);
  }

  for (const [key, name, description] of permissions) {
    const [permission] = await models.Permission.findOrCreate({ where: { key }, defaults: { name, description, active: true } });
    if (permission.name !== name || permission.description !== description || !permission.active) {
      await permission.update({ name, description, active: true });
    }
  }

  for (const [key, value, description, isPublic] of settings) {
    await models.SystemSetting.findOrCreate({ where: { key }, defaults: { value, description, public: isPublic } });
  }

  await bootstrapEntitlementCatalog();
  await db.transaction((transaction) => bootstrapStoreCatalog({ transaction, syncPrices: true }));
  console.log('Precios y moneda del catálogo actualizados.');

  const baseKeys = ['menu.dashboard', 'menu.profile'];
  const allPermissionKeys = (await models.Permission.findAll({ where: { active: true }, attributes: ['key'], order: [['key', 'ASC']] })).map((permission) => permission.key);
  for (const roleKey of createdRoleKeys) await setRolePreset(roleKey, baseKeys);

  const email = String(process.env.BOOTSTRAP_ADMIN_EMAIL || '').trim().toLowerCase();
  const password = String(process.env.BOOTSTRAP_ADMIN_PASSWORD || '');
  const username = String(process.env.BOOTSTRAP_ADMIN_USERNAME || 'admin').trim();

  if (email && password) {
    const [user, created] = await models.User.findOrCreate({
      where: { email },
      defaults: {
        username,
        displayName: process.env.BOOTSTRAP_ADMIN_DISPLAY_NAME || 'Administrator',
        passwordHash: await hashPassword(password),
        statusKey: 'ACTIVE',
        roleKey: 'SUPER_ADMIN'
      }
    });

    if (created) await setUserPermissions(user.id, baseKeys);
    console.log(created ? `Usuario bootstrap creado: ${user.email}` : `Usuario bootstrap ya existente, sin cambios: ${user.email}`);
  } else {
    console.log('Seed completado sin usuario bootstrap. Define BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD si deseas crearlo.');
  }

  const rootUser = await models.User.findByPk(1);
  if (rootUser) {
    if (rootUser.roleKey !== 'SUPER_ADMIN') await rootUser.update({ roleKey: 'SUPER_ADMIN' });
    await setUserPermissions(rootUser.id, allPermissionKeys);
    console.log(`Super Admin raíz asegurado: ${rootUser.email} (usuario interno #1).`);
  } else {
    console.log('No existe todavía el usuario interno #1; el seed no creó un Super Admin raíz.');
  }

  console.log('Seed base completado.');
}

try {
  await seed();
} catch (error) {
  console.error('Error durante el seed:', error);
  process.exitCode = 1;
} finally {
  await db.close();
}
