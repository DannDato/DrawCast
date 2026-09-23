import '../config/env.js';
import { db, models } from '../models/index.js';

try {
  await db.authenticate();
  await models.ChannelGuide.sync();
  console.log('Tabla channel_guides lista.');
} finally {
  await db.close();
}
