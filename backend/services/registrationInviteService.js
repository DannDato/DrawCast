import crypto from 'node:crypto';
import { models } from '../models/index.js';
import { sha256 } from '../helpers/security.js';

function normalizeToken(value) {
  return String(value || '').trim().toLowerCase();
}

function validTokenShape(token) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token);
}

export function registrationInviteHash(token) {
  const normalized = normalizeToken(token);
  return validTokenShape(normalized) ? sha256(normalized) : null;
}

export async function createRegistrationInvite(createdBy, transaction = undefined) {
  const token = crypto.randomUUID();
  const invite = await models.RegistrationInvite.create({
    tokenHash: sha256(token),
    createdBy
  }, { transaction });
  return { invite, token };
}

export async function findUsableRegistrationInvite(token, { transaction = undefined, lock = false } = {}) {
  const tokenHash = registrationInviteHash(token);
  if (!tokenHash) return null;
  return models.RegistrationInvite.findOne({
    where: { tokenHash, usedAt: null, revokedAt: null },
    transaction,
    ...(lock && transaction ? { lock: transaction.LOCK.UPDATE } : {})
  });
}

export async function consumeRegistrationInvite(token, userId, transaction) {
  const invite = await findUsableRegistrationInvite(token, { transaction, lock: true });
  if (!invite) throw Object.assign(new Error('Este enlace de registro ya no está disponible.'), { status: 410, code: 'REGISTRATION_INVITE_INVALID' });
  await invite.update({ usedBy: userId, usedAt: new Date() }, { transaction });
  return invite;
}
