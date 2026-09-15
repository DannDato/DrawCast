import { sha256 } from '../helpers/security.js';
import { models } from '../models/index.js';

const WINDOW_MS = Number(process.env.LOGIN_FAILURE_WINDOW_MINUTES || 15) * 60000;
const LOCK_MS = Number(process.env.LOGIN_LOCK_MINUTES || 15) * 60000;
const MAX_FAILURES = Number(process.env.LOGIN_MAX_FAILURES || 5);
const keyFor = (identifier) => sha256(String(identifier || '').trim().toLowerCase());

export async function loginAllowed(identifier) {
  const row = await models.AuthThrottle.findByPk(keyFor(identifier));
  if (!row) return true;
  if (row.lockedUntil && new Date(row.lockedUntil) > new Date()) return false;
  return true;
}

export async function registerLoginFailure(identifier) {
  const key = keyFor(identifier);
  const now = new Date();
  let row = await models.AuthThrottle.findByPk(key);
  if (!row) row = await models.AuthThrottle.create({ identifierHash: key, failures: 0, firstFailureAt: now });
  const stale = !row.firstFailureAt || now - new Date(row.firstFailureAt) > WINDOW_MS;
  const failures = stale ? 1 : row.failures + 1;
  await row.update({ failures, firstFailureAt: stale ? now : row.firstFailureAt, lastFailureAt: now, lockedUntil: failures >= MAX_FAILURES ? new Date(now.getTime() + LOCK_MS) : null });
}

export async function clearLoginFailures(identifier) {
  await models.AuthThrottle.destroy({ where: { identifierHash: keyFor(identifier) } });
}
