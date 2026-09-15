import jwt from 'jsonwebtoken';
import { models } from '../models/index.js';
import { env } from '../config/env.js';
import { sha256 } from '../helpers/security.js';
import { getUserPermissionKeys } from '../helpers/permissions.js';

export async function verifyToken(req, res, next) {
  try {
    const token = req.cookies?.[env.cookieName];
    if (!token) return res.status(401).json({ message: 'Sesión requerida' });

    const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'fullstack-base' });
    const session = await models.Session.findOne({ where: { id: decoded.sid, userId: decoded.sub, tokenHash: sha256(token), revokedAt: null } });
    if (!session || session.expiresAt <= new Date()) return res.status(401).json({ message: 'Sesión inválida o expirada' });

    const user = await models.User.findByPk(decoded.sub, { include: [{ model: models.Role, as: 'role' }, { model: models.UserStatus, as: 'statusRef' }] });
    if (!user || user.statusKey !== 'ACTIVE') return res.status(403).json({ message: 'Cuenta no disponible' });

    await session.update({ lastSeenAt: new Date() });
    req.user = user;
    req.session = session;
    req.permissions = await getUserPermissionKeys(user.id);
    next();
  } catch {
    return res.status(401).json({ message: 'Sesión inválida o expirada' });
  }
}

export const requirePermissions = (...required) => (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: 'Sesión requerida' });
  if (req.user.roleKey === 'SUPER_ADMIN') return next();
  const keys = new Set(req.permissions || []);
  if (required.every((permission) => keys.has(permission))) return next();
  return res.status(403).json({ message: 'Permisos insuficientes', required });
};
