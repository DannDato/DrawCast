import { Op } from 'sequelize';
import { models } from '../models/index.js';

export async function getUserPermissionKeys(userId, transaction) {
  const rows = await models.UserPermission.findAll({
    where: { userId },
    attributes: ['permissionKey'],
    include: [{ model: models.Permission, as: 'permissionRef', attributes: [], where: { active: true } }],
    transaction
  });

  return [...new Set(rows.map((row) => row.permissionKey))];
}

export async function getRolePresetKeys(roleKey, transaction) {
  if (!roleKey) return [];
  const rows = await models.PresetPermission.findAll({
    where: { roleKey, active: true },
    attributes: ['permissionKey'],
    include: [{ model: models.Permission, as: 'permissionRef', attributes: [], where: { active: true } }],
    transaction
  });

  return [...new Set(rows.map((row) => row.permissionKey))];
}

export async function setUserPermissions(userId, permissionKeys = [], transaction) {
  const uniqueKeys = [...new Set(permissionKeys.map((key) => String(key).trim()).filter(Boolean))];
  const valid = uniqueKeys.length ? await models.Permission.findAll({ where: { key: { [Op.in]: uniqueKeys }, active: true }, attributes: ['key'], transaction }) : [];
  const keys = valid.map((permission) => permission.key);

  await models.UserPermission.destroy({ where: { userId }, transaction });
  if (keys.length) await models.UserPermission.bulkCreate(keys.map((permissionKey) => ({ userId, permissionKey })), { transaction });
  return keys;
}

export async function applyRolePreset(userId, roleKey, transaction) {
  const keys = await getRolePresetKeys(roleKey, transaction);
  return setUserPermissions(userId, keys, transaction);
}

export async function setRolePreset(roleKey, permissionKeys = [], transaction) {
  const uniqueKeys = [...new Set(permissionKeys.map((key) => String(key).trim()).filter(Boolean))];
  const valid = uniqueKeys.length ? await models.Permission.findAll({ where: { key: { [Op.in]: uniqueKeys }, active: true }, attributes: ['key'], transaction }) : [];
  const keys = valid.map((permission) => permission.key);

  await models.PresetPermission.destroy({ where: { roleKey }, transaction });
  if (keys.length) await models.PresetPermission.bulkCreate(keys.map((permissionKey) => ({ roleKey, permissionKey, active: true })), { transaction });
  return keys;
}
