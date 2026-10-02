import { models } from '../models/index.js';
import { clearSettingsCache, getSetting } from './settingsService.js';
import { setUserPermissions } from '../helpers/permissions.js';

export const ROOT_ADMIN_SETTING_KEY = 'admin.root_user_uuid';

export async function getRootAdminUuid(transaction) {
  if (transaction) {
    const row = await models.SystemSetting.findByPk(ROOT_ADMIN_SETTING_KEY, { transaction });
    return String(row?.value || '').trim() || null;
  }
  return String(await getSetting(ROOT_ADMIN_SETTING_KEY, '') || '').trim() || null;
}

export async function isRootAdminUser(user, transaction) {
  if (!user?.uuid) return false;
  const rootUuid = await getRootAdminUuid(transaction);
  return Boolean(rootUuid && rootUuid === user.uuid);
}

export async function grantAllActivePermissions(userId, transaction) {
  const rows = await models.Permission.findAll({
    where: { active: true },
    attributes: ['key'],
    order: [['key', 'ASC']],
    transaction
  });
  return setUserPermissions(userId, rows.map((row) => row.key), transaction);
}

export async function promoteToSuperAdmin(user, transaction) {
  if (!user) throw new Error('Usuario requerido.');
  if (user.roleKey !== 'SUPER_ADMIN') await user.update({ roleKey: 'SUPER_ADMIN' }, { transaction });
  const permissions = await grantAllActivePermissions(user.id, transaction);
  return { user, permissions };
}

export async function setRootAdmin(user, transaction) {
  const result = await promoteToSuperAdmin(user, transaction);
  const [setting] = await models.SystemSetting.findOrCreate({
    where: { key: ROOT_ADMIN_SETTING_KEY },
    defaults: {
      value: user.uuid,
      description: 'UUID del Super Admin raíz protegido del sistema.',
      public: false
    },
    transaction
  });
  await setting.update({ value: user.uuid, public: false }, { transaction });
  clearSettingsCache();
  return result;
}
