import { Op } from 'sequelize';
import { db, models } from '../../models/index.js';
import { audit } from '../../helpers/audit.js';
import { setUserPermissions } from '../../helpers/permissions.js';
import { STORE_PRODUCT_KEYS } from '../../bootstrap/catalogs/store.js';
import { getChannelEntitlements, invalidateChannelEntitlements } from '../../services/channelEntitlementAccessService.js';
import { broadcastChannelEntitlements } from '../../services/channelEntitlementBroadcastService.js';

const MAX_USERS = 100;

function serializeAdminUser(user, permissions = []) {
  return {
    uuid: user.uuid,
    username: user.username,
    email: user.email,
    displayName: user.displayName || null,
    roleKey: user.roleKey,
    statusKey: user.statusKey,
    permissions,
    protectedRoot: Number(user.id) === 1
  };
}

async function permissionMapForUsers(userIds) {
  if (!userIds.length) return new Map();
  const links = await models.UserPermission.findAll({
    where: { userId: { [Op.in]: userIds } },
    attributes: ['userId', 'permissionKey'],
    include: [{ model: models.Permission, as: 'permissionRef', attributes: [], where: { active: true } }],
    order: [['permissionKey', 'ASC']]
  });
  const map = new Map(userIds.map((id) => [Number(id), []]));
  for (const link of links) map.get(Number(link.userId))?.push(link.permissionKey);
  return map;
}


async function collabProduct(transaction = undefined) {
  const product = await models.StoreProduct.findOne({ where: { key: STORE_PRODUCT_KEYS.CANVAS_COLLAB, active: true }, transaction });
  if (!product) throw Object.assign(new Error('Licencia Collab no disponible. Ejecuta npm run seed.'), { status: 503 });
  return product;
}

function serializeCollabLicense(license) {
  if (!license) return null;
  const assignments = license.assignments || [];
  const activeAssignment = assignments.find((assignment) => String(assignment.status || '').toUpperCase() === 'ACTIVE') || null;
  return {
    uuid: license.uuid,
    status: license.status,
    startsAt: license.startsAt || null,
    endsAt: license.endsAt || null,
    permanent: license.endsAt == null && license.currentPeriodEnd == null,
    assignment: activeAssignment ? {
      uuid: activeAssignment.uuid,
      channel: activeAssignment.channel ? { uuid: activeAssignment.channel.uuid, name: activeAssignment.channel.name } : null
    } : null
  };
}

async function collabLicensesForUsers(userIds, productId) {
  if (!userIds.length) return new Map();
  const rows = await models.UserLicense.findAll({
    where: { userId: { [Op.in]: userIds }, productId },
    order: [['createdAt', 'DESC']],
    include: [{ model: models.LicenseAssignment, as: 'assignments', include: [{ model: models.Channel, as: 'channel', attributes: ['uuid', 'name'] }] }]
  });
  const map = new Map();
  for (const row of rows) {
    const id = Number(row.userId);
    if (!map.has(id) || String(row.status).toUpperCase() === 'ACTIVE') map.set(id, row);
  }
  return map;
}

export const SystemAdminController = {
  async permissions(_req, res) {
    const permissions = await models.Permission.findAll({
      where: { active: true },
      attributes: ['key', 'name', 'description'],
      order: [['key', 'ASC']]
    });
    return res.json({ permissions });
  },

  async users(req, res) {
    const q = String(req.query.q || '').trim().slice(0, 120);
    const where = q ? {
      [Op.or]: [
        { username: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { displayName: { [Op.like]: `%${q}%` } }
      ]
    } : {};

    const users = await models.User.findAll({
      where,
      attributes: ['id', 'uuid', 'username', 'email', 'displayName', 'roleKey', 'statusKey'],
      order: [['id', 'ASC']],
      limit: MAX_USERS
    });
    const permissionMap = await permissionMapForUsers(users.map((user) => user.id));
    return res.json({
      users: users.map((user) => serializeAdminUser(user, permissionMap.get(Number(user.id)) || [])),
      limit: MAX_USERS
    });
  },

  async collaborators(req, res) {
    const q = String(req.query.q || '').trim().slice(0, 120);
    const where = q ? {
      [Op.or]: [
        { username: { [Op.like]: `%${q}%` } },
        { email: { [Op.like]: `%${q}%` } },
        { displayName: { [Op.like]: `%${q}%` } }
      ]
    } : {};

    const product = await collabProduct();
    const users = await models.User.findAll({
      where,
      attributes: ['id', 'uuid', 'username', 'email', 'displayName', 'roleKey', 'statusKey'],
      order: [['id', 'ASC']],
      limit: MAX_USERS
    });
    const licenses = await collabLicensesForUsers(users.map((user) => user.id), product.id);
    return res.json({
      users: users.map((user) => ({
        uuid: user.uuid,
        username: user.username,
        email: user.email,
        displayName: user.displayName || null,
        roleKey: user.roleKey,
        statusKey: user.statusKey,
        collabLicense: serializeCollabLicense(licenses.get(Number(user.id)) || null)
      })),
      limit: MAX_USERS
    });
  },

  async grantCollabLicense(req, res) {
    const targetUuid = String(req.params.userUuid || '').trim();
    let createdLicense;
    let target;

    await db.transaction(async (transaction) => {
      target = await models.User.findOne({
        where: { uuid: targetUuid },
        attributes: ['id', 'uuid', 'username', 'email', 'displayName', 'roleKey', 'statusKey'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!target) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
      if (target.statusKey !== 'ACTIVE') throw Object.assign(new Error('La Licencia Collab sólo puede asignarse a usuarios activos.'), { status: 409 });

      const product = await collabProduct(transaction);
      const existing = await models.UserLicense.findOne({
        where: { userId: target.id, productId: product.id, status: 'ACTIVE' },
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (existing) throw Object.assign(new Error('Este usuario ya tiene una Licencia Collab activa.'), { status: 409 });

      createdLicense = await models.UserLicense.create({
        userId: target.id,
        productId: product.id,
        status: 'ACTIVE',
        quantity: 1,
        sourceType: 'admin_collab',
        externalRef: `collab:${target.uuid}`,
        startsAt: new Date(),
        currentPeriodStart: null,
        currentPeriodEnd: null,
        cancelAtPeriodEnd: false,
        endsAt: null,
        metadata: { grantedBy: req.user.uuid, permanent: true }
      }, { transaction });
    });

    await audit(req, {
      event: 'admin.collab_license_granted',
      category: 'admin',
      targetType: 'user',
      targetId: target.uuid,
      metadata: { username: target.username, licenseUuid: createdLicense.uuid }
    });

    return res.status(201).json({ license: serializeCollabLicense(createdLicense) });
  },

  async revokeCollabLicense(req, res) {
    const targetUuid = String(req.params.userUuid || '').trim();
    let target;
    let affectedChannelIds = [];
    let revokedCount = 0;

    await db.transaction(async (transaction) => {
      target = await models.User.findOne({
        where: { uuid: targetUuid },
        attributes: ['id', 'uuid', 'username'],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!target) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });

      const product = await collabProduct(transaction);
      const licenses = await models.UserLicense.findAll({
        where: { userId: target.id, productId: product.id, status: 'ACTIVE' },
        include: [{ model: models.LicenseAssignment, as: 'assignments', where: { status: 'ACTIVE' }, required: false }],
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      if (!licenses.length) throw Object.assign(new Error('Este usuario no tiene una Licencia Collab activa.'), { status: 409 });

      affectedChannelIds = [...new Set(licenses.flatMap((license) => (license.assignments || []).map((assignment) => Number(assignment.channelId)).filter(Boolean)))];
      const now = new Date();
      for (const license of licenses) {
        await license.update({ status: 'REVOKED', canceledAt: now, cancelAtPeriodEnd: false }, { transaction });
      }
      revokedCount = licenses.length;
    });

    for (const channelId of affectedChannelIds) {
      invalidateChannelEntitlements(channelId);
      const entitlements = await getChannelEntitlements(channelId, { fresh: true });
      await broadcastChannelEntitlements(req, channelId, entitlements);
    }

    await audit(req, {
      event: 'admin.collab_license_revoked',
      category: 'admin',
      targetType: 'user',
      targetId: target.uuid,
      metadata: { username: target.username, revokedCount, affectedChannelIds }
    });

    return res.json({ revoked: true, revokedCount });
  },

  async updateUserPermissions(req, res) {
    const permissionKeys = Array.isArray(req.body?.permissions) ? req.body.permissions : null;
    if (!permissionKeys) return res.status(400).json({ message: 'permissions debe ser un arreglo.' });
    if (permissionKeys.length > 100) return res.status(400).json({ message: 'Demasiados permisos.' });
    if (permissionKeys.some((key) => typeof key !== 'string' || !key.trim() || key.length > 120)) {
      return res.status(400).json({ message: 'Lista de permisos inválida.' });
    }

    const target = await models.User.findOne({ where: { uuid: String(req.params.userUuid || '') }, attributes: ['id', 'uuid', 'username', 'email', 'displayName', 'roleKey', 'statusKey'] });
    if (!target) return res.status(404).json({ message: 'Usuario no encontrado.' });
    if (Number(target.id) === 1) return res.status(409).json({ message: 'Los permisos del Super Admin raíz se administran desde el seed del sistema.' });

    const requested = [...new Set(permissionKeys.map((key) => key.trim()))];
    const validRows = requested.length ? await models.Permission.findAll({ where: { key: { [Op.in]: requested }, active: true }, attributes: ['key'] }) : [];
    const validKeys = validRows.map((row) => row.key);
    if (validKeys.length !== requested.length) return res.status(400).json({ message: 'Uno o más permisos no existen o están desactivados.' });

    const permissions = await db.transaction((transaction) => setUserPermissions(target.id, requested, transaction));
    await audit(req, {
      event: 'admin.user_permissions_updated',
      category: 'admin',
      targetType: 'user',
      targetId: target.uuid,
      metadata: { username: target.username, permissions }
    });

    return res.json({ user: serializeAdminUser(target, permissions) });
  }
};
