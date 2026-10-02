import '../config/env.js';

import { db, models } from '../models/index.js';
import { hashPassword } from '../services/authService.js';
import { setRolePreset, setUserPermissions } from '../helpers/permissions.js';
import { bootstrapEntitlementCatalog } from '../services/entitlementCatalogService.js';
import { bootstrapStoreCatalog } from '../services/storeCatalogService.js';
import { getRootAdminUuid, setRootAdmin } from '../services/rootAdminService.js';

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
  ['admin.collaborators.manage', 'Administrar Licencias Collab', 'Permite asignar y revocar Licencias Collab permanentes.'],
  ['admin.modules.manage', 'Administrar bloqueos del sistema', 'Permite prender y apagar Login, Registro, Editor y Tienda.'],
  ['admin.registration_invites.read', 'Consultar invitaciones de registro', 'Permite consultar invitaciones de registro de un solo uso.'],
  ['admin.registration_invites.manage', 'Administrar invitaciones de registro', 'Permite generar y revocar invitaciones de registro de un solo uso.']
];

const settings = [
  ['module.login.enabled', 'true', 'Permite acceder al inicio de sesión.', true],
  ['auth.registration.enabled', 'true', 'Permite el registro público de usuarios.', true],
  ['module.editor.enabled', 'true', 'Permite acceder al Editor y sus operaciones privadas.', true],
  ['module.store.enabled', 'true', 'Permite acceder a Tienda, carrito y checkout.', true]
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

  const configuredRootUuid = await getRootAdminUuid();
  let rootUser = configuredRootUuid ? await models.User.findOne({ where: { uuid: configuredRootUuid } }) : null;

  if (!rootUser) {
    rootUser = await models.User.findByPk(1);
    if (rootUser) {
      await setRootAdmin(rootUser);
      console.log(`Root inicial adoptado desde el usuario interno #1: ${rootUser.email}.`);
    } else if (configuredRootUuid) {
      console.log(`El root configurado (${configuredRootUuid}) ya no existe. Usa npm run admin:root -- <usuario> para reasignarlo.`);
    } else {
      console.log('No hay usuario root configurado. Usa npm run admin:root -- <usuario> cuando exista una cuenta.');
    }
  } else {
    await setRootAdmin(rootUser);
    console.log(`Super Admin raíz asegurado: ${rootUser.email} (${rootUser.uuid}).`);
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
