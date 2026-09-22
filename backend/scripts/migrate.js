import '../config/env.js';
import crypto from 'node:crypto';
import { DataTypes, QueryTypes } from 'sequelize';
import { db, auditDb, models } from '../models/index.js';
import { hasAuditDatabase } from '../config/database.js';
import { validateEnv } from '../config/env.js';

validateEnv();

await db.authenticate();

// Versiones antiguas de DrawCast tenían channels.owner_id como UNIQUE porque
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
