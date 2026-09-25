import '../config/env.js';
import crypto from 'node:crypto';
import { DataTypes, Op, QueryTypes } from 'sequelize';
import { db, auditDb, models } from '../models/index.js';
import { hasAuditDatabase } from '../config/database.js';
import { validateEnv } from '../config/env.js';
import { ENTITLEMENT_BUNDLES, ENTITLEMENT_BUNDLE_KEYS } from '../bootstrap/catalogs/entitlements.js';

validateEnv();

await db.authenticate();

// Versiones antiguas de TRAZIO tenían channels.owner_id como UNIQUE porque
// sólo existía un lienzo por usuario. Antes de sync({ alter:true }) dejamos un
// índice normal disponible para la FK y retiramos el UNIQUE legado.
const queryInterface = db.getQueryInterface();
const tables = (await queryInterface.showAllTables()).map((table) => typeof table === 'string' ? table : (table.tableName || table.name));

async function ensurePublicUuid(tableName, indexName) {
  if (!tables.includes(tableName)) return;

  const columns = await queryInterface.describeTable(tableName);
  if (!columns.uuid) await queryInterface.addColumn(tableName, 'uuid', { type: DataTypes.UUID, allowNull: true });

  const rows = await db.query(`SELECT id, uuid FROM \`${tableName}\` WHERE uuid IS NULL OR uuid = ''`, { type: QueryTypes.SELECT });
  for (const row of rows) await queryInterface.bulkUpdate(tableName, { uuid: crypto.randomUUID() }, { id: row.id });

  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === indexName)) await queryInterface.addIndex(tableName, ['uuid'], { name: indexName, unique: true });
}

await ensurePublicUuid('users', 'users_uuid_uq');
await ensurePublicUuid('channels', 'channels_uuid_uq');
await ensurePublicUuid('channel_invitations', 'channel_invitations_uuid_uq');
await ensurePublicUuid('saved_designs', 'saved_designs_uuid_uq');

if (tables.includes('channels')) {
  let channelIndexes = await queryInterface.showIndex('channels');
  const ownerFields = (index) => (index.fields || []).map((field) => field.attribute || field.name).filter(Boolean);
  const isOwnerField = (field) => field === 'owner_id' || field === 'ownerId';
  const hasNormalOwnerIndex = channelIndexes.some((index) => !index.unique && ownerFields(index).length === 1 && isOwnerField(ownerFields(index)[0]));
  if (!hasNormalOwnerIndex) {
    await queryInterface.addIndex('channels', ['owner_id'], { name: 'channels_owner_id_idx' });
    channelIndexes = await queryInterface.showIndex('channels');
  }
  for (const index of channelIndexes) {
    const fields = ownerFields(index);
    if (index.name !== 'PRIMARY' && index.unique && fields.length === 1 && isOwnerField(fields[0])) {
      await queryInterface.removeIndex('channels', index.name);
      console.log(`Índice UNIQUE legado eliminado: ${index.name}`);
    }
  }
}

await db.sync({ alter: true });

async function runTrackedMigration(key, migrate) {
  const migrationTable = 'trazio_migrations';
  const currentTables = (await queryInterface.showAllTables()).map((table) => typeof table === 'string' ? table : (table.tableName || table.name));
  if (!currentTables.includes(migrationTable)) {
    await queryInterface.createTable(migrationTable, {
      key: { type: DataTypes.STRING(160), allowNull: false, primaryKey: true },
      applied_at: { type: DataTypes.DATE, allowNull: false }
    });
  }

  const [existing] = await db.query(`SELECT \`key\` FROM \`${migrationTable}\` WHERE \`key\` = :key LIMIT 1`, {
    replacements: { key },
    type: QueryTypes.SELECT
  });
  if (existing) return false;

  await db.transaction(async (transaction) => {
    await migrate(transaction);
    await queryInterface.bulkInsert(migrationTable, [{ key, applied_at: new Date() }], { transaction });
  });
  console.log(`Migración aplicada: ${key}`);
  return true;
}

await runTrackedMigration('119_launchpad_pads_expandable', async (transaction) => {
  const capability = await models.EntitlementCapability.findOne({ where: { key: 'limit.launchpad_pads' }, transaction });
  if (!capability) return;
  await capability.update({ expandable: true, hardMax: 24 }, { transaction });
});


await runTrackedMigration('119_2_launchpad_lite_legacy_pad_limit', async (transaction) => {
  const [bundle, capability] = await Promise.all([
    models.EntitlementBundle.findOne({ where: { key: 'tool.launchpad' }, transaction }),
    models.EntitlementCapability.findOne({ where: { key: 'limit.launchpad_pads' }, transaction })
  ]);
  if (!bundle || !capability) return;

  const grant = await models.EntitlementGrant.findOne({
    where: { bundleId: bundle.id, capabilityId: capability.id },
    transaction
  });
  if (!grant) return;

  // Sólo transforma el valor legado conocido. Si ya fue administrado manualmente,
  // la BD sigue siendo la fuente de verdad y no lo tocamos.
  if (grant.operation === 'set' && Number(grant.value) === 24) {
    await grant.update({ value: 8 }, { transaction });
  }
});

await runTrackedMigration('119_3_launchpad_lite_json_pad_limit', async (transaction) => {
  const [bundle, capability] = await Promise.all([
    models.EntitlementBundle.findOne({ where: { key: 'tool.launchpad' }, transaction }),
    models.EntitlementCapability.findOne({ where: { key: 'limit.launchpad_pads' }, transaction })
  ]);
  if (!bundle || !capability) return;

  const grant = await models.EntitlementGrant.findOne({
    where: { bundleId: bundle.id, capabilityId: capability.id },
    transaction
  });
  if (!grant || grant.operation !== 'set') return;

  // MariaDB/Sequelize puede devolver JSON como string serializado (incluso anidado).
  // Decodificamos el valor legado antes de compararlo. Sólo 24 -> 8; cualquier
  // valor administrado manualmente permanece intacto.
  let legacyValue = grant.value;
  for (let i = 0; i < 3 && typeof legacyValue === 'string'; i += 1) {
    try { legacyValue = JSON.parse(legacyValue); } catch { break; }
  }

  if (Number(legacyValue) === 24) {
    await grant.update({ value: 8 }, { transaction });
  }
});


await runTrackedMigration('119_5_launchpad_lite_isolation', async (transaction) => {
  const [product, launchpadBundle, launchpadCapability, padsCapability] = await Promise.all([
    models.StoreProduct.findOne({ where: { key: 'tool.launchpad' }, transaction }),
    models.EntitlementBundle.findOne({ where: { key: 'tool.launchpad' }, transaction }),
    models.EntitlementCapability.findOne({ where: { key: 'editor.launchpad' }, transaction }),
    models.EntitlementCapability.findOne({ where: { key: 'limit.launchpad_pads' }, transaction })
  ]);
  if (!product || !launchpadBundle || !launchpadCapability || !padsCapability) return;

  // Repara únicamente el contrato conocido de Launchpad Lite introducido en 118/119.
  // No sincroniza el catálogo completo ni toca productos administrados ajenos.
  await models.StoreProductBundle.destroy({
    where: {
      productId: product.id,
      bundleId: { [Op.ne]: launchpadBundle.id }
    },
    transaction
  });

  await models.StoreProductBundle.findOrCreate({
    where: { productId: product.id, bundleId: launchpadBundle.id },
    defaults: {},
    transaction
  });

  const allowedCapabilityIds = [launchpadCapability.id, padsCapability.id];
  const launchpadGrants = await models.EntitlementGrant.findAll({ where: { bundleId: launchpadBundle.id }, transaction });
  for (const grant of launchpadGrants) {
    if (!allowedCapabilityIds.includes(Number(grant.capabilityId))) await grant.destroy({ transaction });
  }

  const [featureGrant] = await models.EntitlementGrant.findOrCreate({
    where: { bundleId: launchpadBundle.id, capabilityId: launchpadCapability.id },
    defaults: { operation: 'set', value: true },
    transaction
  });
  await featureGrant.update({ operation: 'set', value: true }, { transaction });

  const [padsGrant] = await models.EntitlementGrant.findOrCreate({
    where: { bundleId: launchpadBundle.id, capabilityId: padsCapability.id },
    defaults: { operation: 'set', value: 8 },
    transaction
  });
  await padsGrant.update({ operation: 'set', value: 8 }, { transaction });

  // También limpia entitlements persistidos por asignaciones Launchpad Lite ya existentes.
  // Un Plus legítimo de otra licencia conserva su sourceRef y no se toca.
  const assignments = await models.LicenseAssignment.findAll({
    where: { status: 'ACTIVE' },
    include: [{
      model: models.UserLicense,
      as: 'license',
      required: true,
      include: [{ model: models.StoreProduct, as: 'product', where: { key: 'tool.launchpad' }, required: true }]
    }],
    transaction
  });

  for (const assignment of assignments) {
    const sourceRef = `assignment:${assignment.uuid}`;
    const rows = await models.ChannelEntitlement.findAll({
      where: { channelId: assignment.channelId, sourceType: 'license', sourceRef, status: 'ACTIVE' },
      transaction
    });

    for (const row of rows) {
      if (Number(row.bundleId) !== Number(launchpadBundle.id)) {
        await row.update({ status: 'RELEASED', endsAt: new Date() }, { transaction });
      }
    }

    const existing = rows.find((row) => Number(row.bundleId) === Number(launchpadBundle.id));
    if (!existing) {
      await models.ChannelEntitlement.create({
        channelId: assignment.channelId,
        bundleId: launchpadBundle.id,
        sourceType: 'license',
        sourceRef,
        status: 'ACTIVE',
        startsAt: assignment.assignedAt || new Date(),
        endsAt: null,
        metadata: { repairedBy: '119_5_launchpad_lite_isolation', productKey: 'tool.launchpad' }
      }, { transaction });
    }
  }
});

await runTrackedMigration('119_6_license_entitlement_integrity', async (transaction) => {
  const [launchpadProduct, launchpadBundle, launchpadFeature, launchpadPads] = await Promise.all([
    models.StoreProduct.findOne({ where: { key: 'tool.launchpad' }, transaction }),
    models.EntitlementBundle.findOne({ where: { key: 'tool.launchpad' }, transaction }),
    models.EntitlementCapability.findOne({ where: { key: 'editor.launchpad' }, transaction }),
    models.EntitlementCapability.findOne({ where: { key: 'limit.launchpad_pads' }, transaction })
  ]);

  // Repite de forma explícita la reparación de 119.5 porque ese patch histórico podía
  // haberse aplicado bajo una carpeta DrawCast/ anidada. Esta migración vive ya en la
  // ruta real backend/ y deja el contrato de Launchpad Lite aislado una sola vez.
  if (launchpadProduct && launchpadBundle && launchpadFeature && launchpadPads) {
    await models.StoreProductBundle.destroy({
      where: { productId: launchpadProduct.id, bundleId: { [Op.ne]: launchpadBundle.id } },
      transaction
    });
    await models.StoreProductBundle.findOrCreate({
      where: { productId: launchpadProduct.id, bundleId: launchpadBundle.id },
      defaults: {},
      transaction
    });

    await models.EntitlementGrant.destroy({
      where: {
        bundleId: launchpadBundle.id,
        capabilityId: { [Op.notIn]: [launchpadFeature.id, launchpadPads.id] }
      },
      transaction
    });

    const [featureGrant] = await models.EntitlementGrant.findOrCreate({
      where: { bundleId: launchpadBundle.id, capabilityId: launchpadFeature.id },
      defaults: { operation: 'set', value: true },
      transaction
    });
    await featureGrant.update({ operation: 'set', value: true }, { transaction });

    const [padsGrant] = await models.EntitlementGrant.findOrCreate({
      where: { bundleId: launchpadBundle.id, capabilityId: launchpadPads.id },
      defaults: { operation: 'set', value: 8 },
      transaction
    });
    await padsGrant.update({ operation: 'set', value: 8 }, { transaction });
  }

  // Reconcilia el histórico de entitlements de licencia contra la relación actual
  // producto -> bundles. Un entitlement viejo que ya no pertenece al producto se libera.
  const assignments = await models.LicenseAssignment.findAll({
    where: { status: 'ACTIVE' },
    include: [{
      model: models.UserLicense,
      as: 'license',
      required: true,
      where: { status: 'ACTIVE' },
      include: [{
        model: models.StoreProduct,
        as: 'product',
        required: true,
        where: { active: true },
        include: [{ model: models.StoreProductBundle, as: 'bundleLinks', required: false }]
      }]
    }],
    transaction
  });

  for (const assignment of assignments) {
    const sourceRef = `assignment:${assignment.uuid}`;
    const allowedBundleIds = new Set((assignment.license?.product?.bundleLinks || []).map((link) => Number(link.bundleId)));
    const rows = await models.ChannelEntitlement.findAll({
      where: { channelId: assignment.channelId, sourceType: 'license', sourceRef, status: 'ACTIVE' },
      transaction
    });

    for (const row of rows) {
      if (!allowedBundleIds.has(Number(row.bundleId))) {
        await row.update({ status: 'RELEASED', endsAt: new Date() }, { transaction });
      }
    }

    for (const bundleId of allowedBundleIds) {
      const existing = rows.find((row) => Number(row.bundleId) === bundleId && String(row.status).toUpperCase() === 'ACTIVE');
      if (existing) continue;
      await models.ChannelEntitlement.create({
        channelId: assignment.channelId,
        bundleId,
        sourceType: 'license',
        sourceRef,
        status: 'ACTIVE',
        startsAt: assignment.license?.startsAt || assignment.assignedAt || new Date(),
        endsAt: assignment.license?.endsAt || null,
        metadata: { repairedBy: '119_6_license_entitlement_integrity' }
      }, { transaction });
    }
  }
});


await runTrackedMigration('119_7_channel_entitlement_source_integrity', async (transaction) => {
  // Los grants dev-cli eran una herramienta de desarrollo anterior a Inventario.
  // No pertenecen a una UserLicense/LicenseAssignment y, por tanto, pueden enmascarar
  // el resultado real de asignar o liberar una licencia desde la aplicación.
  await models.ChannelEntitlement.update(
    { status: 'RELEASED', endsAt: new Date() },
    {
      where: {
        sourceType: 'admin',
        sourceRef: { [Op.like]: 'dev-cli:%' },
        status: 'ACTIVE'
      },
      transaction
    }
  );

  // Repara una sola vez el baseline del lienzo. canvas.free es la frontera de
  // seguridad/comercial que se aplica a TODOS los lienzos; no puede arrastrar grants
  // premium históricos. Después de esta migración la BD vuelve a ser la fuente de verdad.
  const freeDefinition = ENTITLEMENT_BUNDLES.find((bundle) => bundle.key === ENTITLEMENT_BUNDLE_KEYS.CANVAS_FREE);
  const freeBundle = await models.EntitlementBundle.findOne({ where: { key: ENTITLEMENT_BUNDLE_KEYS.CANVAS_FREE }, transaction });
  if (!freeDefinition || !freeBundle) return;

  const capabilities = await models.EntitlementCapability.findAll({ where: { scope: 'channel' }, transaction });
  const capabilityByKey = new Map(capabilities.map((capability) => [capability.key, capability]));
  const allowedCapabilityIds = new Set();

  for (const [capabilityKey, definition] of Object.entries(freeDefinition.grants || {})) {
    const capability = capabilityByKey.get(capabilityKey);
    if (!capability) continue;
    allowedCapabilityIds.add(Number(capability.id));

    const operation = definition && typeof definition === 'object' && !Array.isArray(definition) && Object.hasOwn(definition, 'value')
      ? (definition.operation || 'set')
      : 'set';
    const value = definition && typeof definition === 'object' && !Array.isArray(definition) && Object.hasOwn(definition, 'value')
      ? definition.value
      : definition;

    const [grant] = await models.EntitlementGrant.findOrCreate({
      where: { bundleId: freeBundle.id, capabilityId: capability.id },
      defaults: { operation, value },
      transaction
    });
    await grant.update({ operation, value }, { transaction });
  }

  const persisted = await models.EntitlementGrant.findAll({ where: { bundleId: freeBundle.id }, transaction });
  for (const grant of persisted) {
    if (!allowedCapabilityIds.has(Number(grant.capabilityId))) await grant.destroy({ transaction });
  }
});

function rewriteChannelMediaUrls(value, channelId, channelUuid) {
  let changed = false;
  const legacyPattern = new RegExp(`(/channel-media/)${channelId}(/)`, 'g');

  const walk = (current) => {
    if (typeof current === 'string') {
      const next = current.replace(legacyPattern, `$1${channelUuid}$2`);
      if (next !== current) changed = true;
      return next;
    }
    if (Array.isArray(current)) return current.map(walk);
    if (current && typeof current === 'object') {
      return Object.fromEntries(Object.entries(current).map(([key, item]) => [key, walk(item)]));
    }
    return current;
  };

  return { changed, value: walk(value) };
}

if (tables.includes('saved_designs') && tables.includes('channels')) {
  const channels = await models.Channel.findAll({ attributes: ['id', 'uuid'] });
  const uuidById = new Map(channels.map((channel) => [Number(channel.id), channel.uuid]));
  const designs = await models.SavedDesign.findAll({ attributes: ['id', 'channelId', 'state', 'sizeBytes'] });
  let rewritten = 0;

  for (const design of designs) {
    const channelUuid = uuidById.get(Number(design.channelId));
    if (!channelUuid) continue;
    const next = rewriteChannelMediaUrls(design.state, design.channelId, channelUuid);
    if (!next.changed) continue;
    await design.update({ state: next.value, sizeBytes: Buffer.byteLength(JSON.stringify(next.value), 'utf8') });
    rewritten += 1;
  }

  if (rewritten) console.log(`URLs legacy de medios actualizadas a UUID en ${rewritten} diseño(s).`);
}

console.log('Base de datos principal sincronizada.');

if (hasAuditDatabase) {
  await auditDb.authenticate();
  await auditDb.sync();
  console.log('Base de datos de auditoría sincronizada.');
} else {
  console.log('Auditoría configurada sobre la base de datos principal.');
}

await db.close();
if (hasAuditDatabase) await auditDb.close();
