import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { env } from '../config/env.js';
import { models } from '../models/index.js';
import { sha256 } from '../helpers/security.js';
import { getClientIp } from '../helpers/ip.js';
import { getUserPermissionKeys } from '../helpers/permissions.js';

export async function createSession(req, user) {
  const sid = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + env.sessionDays * 86400000);
  const token = jwt.sign({ sub: user.id, sid }, env.jwtSecret, { expiresIn: `${env.sessionDays}d`, issuer: 'fullstack-base' });
  await models.Session.create({ id: sid, userId: user.id, tokenHash: sha256(token), ip: getClientIp(req), userAgent: String(req.get('user-agent') || '').slice(0, 500), expiresAt });
  return token;
}

export function setSessionCookie(res, token) {
  res.cookie(env.cookieName, token, { httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, maxAge: env.sessionDays * 86400000, path: '/' });
}

export function clearSessionCookie(res) {
  res.clearCookie(env.cookieName, { httpOnly: true, secure: env.cookieSecure, sameSite: env.cookieSameSite, path: '/' });
}

export const hashPassword = (password) => bcrypt.hash(password, env.bcryptRounds);
export const verifyPassword = (password, hash) => bcrypt.compare(password, hash);

export async function serializeUser(user) {
  const loaded = user.role && user.statusRef ? user : await models.User.findByPk(user.id, {
    include: [
      { model: models.Role, as: 'role' },
      { model: models.UserStatus, as: 'statusRef' }
    ]
  });
  const permissions = await getUserPermissionKeys(loaded.id);
  return {
    id: loaded.id,
    username: loaded.username,
    email: loaded.email,
    displayName: loaded.displayName,
    avatarUrl: loaded.avatarUrl || null,
    status: loaded.statusKey,
    statusRef: loaded.statusRef || null,
    role: loaded.role ? { id: loaded.role.id, key: loaded.role.key, name: loaded.role.name } : null,
    permissions
  };
}
