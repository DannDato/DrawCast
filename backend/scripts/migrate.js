import '../config/env.js';
import { db, auditDb } from '../models/index.js';
import { hasAuditDatabase } from '../config/database.js';
import { validateEnv } from '../config/env.js';

validateEnv();

await db.authenticate();

// Versiones antiguas de DrawCast tenían channels.owner_id como UNIQUE porque
// sólo existía un lienzo por usuario. Antes de sync({ alter:true }) dejamos un
// índice normal disponible para la FK y retiramos el UNIQUE legado.
const queryInterface = db.getQueryInterface();
const tables = (await queryInterface.showAllTables()).map((table) => typeof table === 'string' ? table : (table.tableName || table.name));
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
