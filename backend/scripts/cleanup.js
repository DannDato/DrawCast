import '../config/env.js';
import { Op } from 'sequelize';
import { db, models } from '../models/index.js';

const now = new Date();
const retentionDays = Number(process.env.SECURITY_CLEANUP_RETENTION_DAYS || 7);
const old = new Date(Date.now() - retentionDays * 86400000);

async function cleanup() {
  await db.authenticate();
  const results = {};
  results.otpChallenges = await models.OtpChallenge.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { consumedAt: { [Op.lt]: old } }] } });
  results.passwordResets = await models.PasswordReset.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { usedAt: { [Op.lt]: old } }] } });
  results.sessions = await models.Session.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { revokedAt: { [Op.lt]: old } }] } });
  results.trustedDevices = await models.TrustedDevice.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { revokedAt: { [Op.lt]: old } }] } });
  results.emailChanges = await models.EmailChange.destroy({ where: { [Op.or]: [{ expiresAt: { [Op.lt]: now } }, { consumedAt: { [Op.lt]: old } }] } });
  results.authThrottles = await models.AuthThrottle.destroy({ where: { updatedAt: { [Op.lt]: old } } });
  console.log('Limpieza de seguridad completada:', results);
}

try { await cleanup(); }
catch (error) { console.error('Error durante cleanup:', error); process.exitCode = 1; }
finally { await db.close(); }
