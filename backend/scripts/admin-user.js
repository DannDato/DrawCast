import '../config/env.js';

import { Op } from 'sequelize';
import { db, models } from '../models/index.js';
import { getRootAdminUuid, promoteToSuperAdmin, setRootAdmin } from '../services/rootAdminService.js';
import { applyRolePreset } from '../helpers/permissions.js';

const action = String(process.argv[2] || '').trim().toLowerCase();
const identifier = String(process.argv[3] || '').trim();

function usage() {
  console.log('Uso:');
  console.log('  node scripts/admin-user.js promote <email|username|uuid>');
  console.log('  node scripts/admin-user.js root <email|username|uuid>');
  console.log('  node scripts/admin-user.js demote <email|username|uuid>');
}

async function findUser(value, transaction) {
  const normalized = value.toLowerCase();
  return models.User.findOne({
    where: {
      [Op.or]: [
        { uuid: value },
        { email: normalized },
        { username: value }
      ]
    },
    transaction
  });
}

async function main() {
  if (!['promote', 'root', 'demote'].includes(action) || !identifier) {
    usage();
    process.exitCode = 1;
    return;
  }

  await db.authenticate();

  await db.transaction(async (transaction) => {
    const user = await findUser(identifier, transaction);
    if (!user) throw Object.assign(new Error(`Usuario no encontrado: ${identifier}`), { code: 'USER_NOT_FOUND' });

    if (action === 'promote') {
      const { permissions } = await promoteToSuperAdmin(user, transaction);
      console.log(`SUPER_ADMIN asignado: ${user.email} (${user.uuid})`);
      console.log(`Permisos activos sincronizados: ${permissions.length}`);
      return;
    }

    if (action === 'root') {
      const previousRootUuid = await getRootAdminUuid(transaction);
      const { permissions } = await setRootAdmin(user, transaction);
      console.log(`ROOT SUPER_ADMIN asignado: ${user.email} (${user.uuid})`);
      if (previousRootUuid && previousRootUuid !== user.uuid) console.log(`Root anterior reemplazado: ${previousRootUuid}`);
      console.log(`Permisos activos sincronizados: ${permissions.length}`);
      return;
    }

    const rootUuid = await getRootAdminUuid(transaction);
    if (rootUuid === user.uuid) {
      throw Object.assign(new Error('No puedes degradar al usuario root. Asigna primero otro root con admin:root.'), { code: 'ROOT_PROTECTED' });
    }

    await user.update({ roleKey: 'USER' }, { transaction });
    const permissions = await applyRolePreset(user.id, 'USER', transaction);
    console.log(`SUPER_ADMIN retirado: ${user.email} (${user.uuid})`);
    console.log(`Permisos restaurados al preset USER: ${permissions.length}`);
  });
}

try {
  await main();
} catch (error) {
  console.error(`Error: ${error.message}`);
  process.exitCode = 1;
} finally {
  await db.close();
}
