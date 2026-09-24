import '../config/env.js';

import { db, models } from '../models/index.js';
import { hashPassword } from '../services/authService.js';
import { setRolePreset, setUserPermissions } from '../helpers/permissions.js';
import { seedEntitlementCatalog } from '../services/entitlementCatalogService.js';
import { seedStoreCatalog } from '../services/storeCatalogService.js';

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
  ['menu.dashboard', 'Ver inicio'],
  ['menu.profile', 'Ver perfil']
];

const settings = [
  ['auth.registration.enabled', 'true', 'Permite el registro público de usuarios.', true]
];

async function seed() {
  await db.authenticate();

  for (const [key, name, system] of statuses) {
    const [row] = await models.UserStatus.findOrCreate({ where: { key }, defaults: { name, system, active: true } });
    await row.update({ name, system, active: true });
  }

  for (const [key, name, system] of roles) {
    const [row] = await models.Role.findOrCreate({ where: { key }, defaults: { name, system, active: true } });
    await row.update({ name, system, active: true });
  }

  for (const [key, name] of permissions) {
    const [row] = await models.Permission.findOrCreate({ where: { key }, defaults: { name, active: true } });
    await row.update({ name, active: true });
  }

  for (const [key, value, description, isPublic] of settings) {
    const [row] = await models.SystemSetting.findOrCreate({ where: { key }, defaults: { value, description, public: isPublic } });
    await row.update({ description, public: isPublic });
  }

  await seedEntitlementCatalog({ overwriteSystemDefaults: process.env.ENTITLEMENT_SEED_OVERWRITE === 'true' });
  await seedStoreCatalog({ overwriteSystemDefaults: process.env.STORE_SEED_OVERWRITE === 'true' });

  const baseKeys = permissions.map(([key]) => key);
  await setRolePreset('SUPER_ADMIN', baseKeys);
  await setRolePreset('ADMIN', baseKeys);
  await setRolePreset('USER', baseKeys);

  const existingUsers = await models.User.findAll();
  for (const user of existingUsers) {
    const count = await models.UserPermission.count({ where: { userId: user.id } });
    if (count === 0) await setUserPermissions(user.id, baseKeys);
  }

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

    if (!created) await user.update({ roleKey: 'SUPER_ADMIN', statusKey: 'ACTIVE' });
    await setUserPermissions(user.id, baseKeys);
    console.log(created ? `Usuario bootstrap creado: ${user.email}` : `Usuario bootstrap actualizado: ${user.email}`);
  } else {
    console.log('Seed completado sin usuario bootstrap. Define BOOTSTRAP_ADMIN_EMAIL y BOOTSTRAP_ADMIN_PASSWORD si deseas crearlo.');
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
