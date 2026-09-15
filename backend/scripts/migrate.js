import '../config/env.js';
import { db, auditDb } from '../models/index.js';
import { hasAuditDatabase } from '../config/database.js';
import { validateEnv } from '../config/env.js';

validateEnv();

await db.authenticate();
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
