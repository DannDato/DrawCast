import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { models } from '../../models/index.js';
import { audit } from '../../helpers/audit.js';
import { clearSessionCookie, hashPassword, serializeUser, verifyPassword } from '../../services/authService.js';
import { clearTrustedDeviceCookie, revokeTrustedDevices } from '../../services/otpService.js';
import { validatePasswordPolicy } from '../../services/passwordPolicy.js';
import { sendEmailChangeCode } from '../../services/emailService.js';
import { notifySecurity } from '../../services/securityNotificationService.js';
import { exchangeGoogleCode, googleCodeFlowConfigured, googleIdentityConfigured, verifyGoogleCredential } from '../../services/googleOAuthService.js';
import { env } from '../../config/env.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const backendRoot = path.resolve(__dirname, '../..');
const uploadRoot = path.resolve(backendRoot, process.env.UPLOAD_DIR || 'uploads');
const avatarDirectory = path.join(uploadRoot, 'avatars');
const avatarPublicBase = `${process.env.APP_FOLDER || '/api'}/uploads/avatars`;
const avatarTypes = new Map([['image/jpeg', 'jpg'], ['image/png', 'png'], ['image/webp', 'webp']]);
const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();

function safeSession(session, currentSessionId) { return { id: session.id, ip: session.ip || null, userAgent: session.userAgent || 'Dispositivo desconocido', createdAt: session.createdAt, lastSeenAt: session.lastSeenAt || session.createdAt, expiresAt: session.expiresAt, current: session.id === currentSessionId }; }
async function activeSessions(userId, currentSessionId) { const rows = await models.Session.findAll({ where: { userId, revokedAt: null, expiresAt: { [Op.gt]: new Date() } }, order: [['createdAt', 'DESC']] }); return rows.map((session) => safeSession(session, currentSessionId)); }
async function removeStoredAvatar(avatarUrl) { const fileName = path.basename(String(avatarUrl || '')); if (!fileName || fileName === '.' || fileName === path.sep) return; try { await fs.unlink(path.join(avatarDirectory, fileName)); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
function disconnectSessionSockets(req, sessionId) { req.app.get('io')?.in(`session:${sessionId}`).disconnectSockets(true); }
function disconnectUserSockets(req, userId) { req.app.get('io')?.in(`user:${userId}`).disconnectSockets(true); }

class ProfileController {
  get = async (req, res) => {
    const [user, sessions, oauthAccounts] = await Promise.all([serializeUser(req.user), activeSessions(req.user.id, req.session?.id), models.OAuthAccount.findAll({ where: { userId: req.user.id, active: true }, attributes: ['id', 'provider', 'email', 'avatarUrl', 'createdAt'], order: [['createdAt', 'ASC']] })]);
    return res.json({ user, sessions, hasPassword: Boolean(req.user.passwordHash), connectedAccounts: oauthAccounts });
  };

  update = async (req, res) => { const displayName = String(req.body.displayName || '').trim().slice(0, 120); if (!displayName) return res.status(400).json({ message: 'El nombre para mostrar es obligatorio' }); await req.user.update({ displayName }); await audit(req, { event: 'profile.update', category: 'user', userId: req.user.id }); return res.json({ user: await serializeUser(req.user) }); };

  changePassword = async (req, res) => {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const policy = validatePasswordPolicy(newPassword);
    if (!policy.ok) return res.status(400).json({ message: policy.message });
    const hadPassword = Boolean(req.user.passwordHash);
    if (hadPassword) {
      if (!(await verifyPassword(currentPassword, req.user.passwordHash))) return res.status(400).json({ message: 'La contraseña actual no es correcta' });
      if (await verifyPassword(newPassword, req.user.passwordHash)) return res.status(400).json({ message: 'La nueva contraseña debe ser diferente a la actual' });
    }
    await req.user.update({ passwordHash: await hashPassword(newPassword) });
    const otherSessions = await models.Session.findAll({ where: { userId: req.user.id, id: { [Op.ne]: req.session.id }, revokedAt: null }, attributes: ['id'] });
    await models.Session.update({ revokedAt: new Date() }, { where: { userId: req.user.id, id: { [Op.ne]: req.session.id }, revokedAt: null } });
    otherSessions.forEach((session) => disconnectSessionSockets(req, session.id));
    await revokeTrustedDevices(req.user.id);
    clearTrustedDeviceCookie(res);
    await audit(req, { event: 'profile.password_changed', category: 'security', userId: req.user.id });
    await notifySecurity(req.user, hadPassword ? 'Contraseña modificada' : 'Contraseña configurada', ['Las demás sesiones fueron cerradas automáticamente.']);
    return res.json({ message: hadPassword ? 'Contraseña actualizada. Las demás sesiones fueron cerradas.' : 'Contraseña configurada. Las demás sesiones fueron cerradas.' });
  };

  requestEmailChange = async (req, res) => {
    const newEmail = normalizeEmail(req.body.email);
    const currentPassword = String(req.body.currentPassword || '');
    if (!validEmail(newEmail)) return res.status(400).json({ message: 'Ingresa un correo válido' });
    if (newEmail === normalizeEmail(req.user.email)) return res.status(400).json({ message: 'Ese ya es tu correo actual' });
    if (await models.User.findOne({ where: { email: newEmail, id: { [Op.ne]: req.user.id } } })) return res.status(409).json({ message: 'Ese correo ya está registrado' });
    if (req.user.passwordHash && !(await verifyPassword(currentPassword, req.user.passwordHash))) return res.status(400).json({ message: 'La contraseña actual no es correcta' });
    const code = String(crypto.randomInt(100000, 1000000));
    await models.EmailChange.update({ consumedAt: new Date() }, { where: { userId: req.user.id, consumedAt: null } });
    const row = await models.EmailChange.create({ userId: req.user.id, newEmail, codeHash: await bcrypt.hash(code, env.otpBcryptRounds), expiresAt: new Date(Date.now() + env.otpMinutes * 60000) });
    try { await sendEmailChangeCode(newEmail, code, env.otpMinutes); } catch (error) { await row.destroy(); throw error; }
    await audit(req, { event: 'profile.email_change_requested', category: 'security', userId: req.user.id });
    return res.json({ challengeId: row.id, message: 'Enviamos un código al nuevo correo.' });
  };

  confirmEmailChange = async (req, res) => {
    const row = await models.EmailChange.findOne({ where: { id: String(req.body.challengeId || ''), userId: req.user.id, consumedAt: null } });
    if (!row || row.expiresAt <= new Date()) return res.status(400).json({ message: 'El código expiró. Solicita uno nuevo.' });
    if (row.attempts >= env.otpMaxAttempts) return res.status(429).json({ message: 'Demasiados intentos. Solicita un código nuevo.' });
    const code = String(req.body.code || '');
    const matches = /^\d{6}$/.test(code) && await bcrypt.compare(code, row.codeHash);
    if (!matches) { await row.increment('attempts'); return res.status(400).json({ message: 'Código incorrecto' }); }
    if (await models.User.findOne({ where: { email: row.newEmail, id: { [Op.ne]: req.user.id } } })) return res.status(409).json({ message: 'Ese correo ya está registrado' });
    const oldEmail = req.user.email;
    await row.update({ consumedAt: new Date() });
    await req.user.update({ email: row.newEmail, emailVerifiedAt: new Date() });
    await audit(req, { event: 'profile.email_changed', category: 'security', userId: req.user.id, metadata: { oldEmail } });
    await notifySecurity({ ...req.user.get({ plain: true }), email: oldEmail }, 'Correo de la cuenta modificado', [`El correo de acceso cambió a ${row.newEmail}.`]);
    await notifySecurity(req.user, 'Nuevo correo confirmado', ['Este correo quedó asociado a tu cuenta.']);
    return res.json({ message: 'Correo actualizado correctamente', user: await serializeUser(req.user) });
  };

  connectGoogle = async (req, res) => {
    if (!googleIdentityConfigured()) return res.status(503).json({ message: 'Google OAuth no configurado' });
    const credential = String(req.body.credential || '');
    if (!credential) return res.status(400).json({ message: 'Credencial de Google requerida' });
    let payload;
    try { payload = await verifyGoogleCredential(credential); }
    catch { return res.status(401).json({ message: 'Identidad de Google inválida' }); }
    return this.finishGoogleConnection(req, res, payload);
  };

  connectGoogleCode = async (req, res) => {
    if (!googleCodeFlowConfigured()) return res.status(503).json({ message: 'Google OAuth no configurado' });
    if (req.get('x-requested-with') !== 'XmlHttpRequest') return res.status(400).json({ message: 'Solicitud de Google no válida' });
    let payload;
    try { payload = await exchangeGoogleCode(String(req.body.code || '')); }
    catch { return res.status(401).json({ message: 'No se pudo validar la cuenta de Google' }); }
    return this.finishGoogleConnection(req, res, payload);
  };

  finishGoogleConnection = async (req, res, payload) => {
    const occupied = await models.OAuthAccount.findOne({ where: { provider: 'google', providerUserId: payload.sub, userId: { [Op.ne]: req.user.id } } });
    if (occupied) return res.status(409).json({ message: 'Esa cuenta de Google ya está conectada a otro usuario' });
    const email = normalizeEmail(payload.email);
    const emailOwner = await models.User.findOne({ where: { email, id: { [Op.ne]: req.user.id } }, attributes: ['id'] });
    if (emailOwner) return res.status(409).json({ message: 'El correo de esa cuenta de Google ya pertenece a otra cuenta de TRAZIO' });
    let account = await models.OAuthAccount.findOne({ where: { userId: req.user.id, provider: 'google' } });
    const values = { providerUserId: payload.sub, email, avatarUrl: payload.picture || null, active: true };
    if (account) await account.update(values); else account = await models.OAuthAccount.create({ userId: req.user.id, provider: 'google', ...values });
    await audit(req, { event: 'profile.google_connected', category: 'security', userId: req.user.id });
    await notifySecurity(req.user, 'Cuenta de Google conectada', [`Se conectó ${payload.email} como método de acceso.`]);
    return res.json({ message: 'Cuenta de Google conectada', account: { id: account.id, provider: account.provider, email: account.email, avatarUrl: account.avatarUrl } });
  };

  disconnectOAuth = async (req, res) => {
    const provider = String(req.params.provider || '').trim().toLowerCase();
    const labels = { google: 'Google', twitch: 'Twitch', kick: 'Kick', discord: 'Discord' };
    const label = labels[provider];
    if (!label) return res.status(400).json({ message: 'Proveedor de acceso no válido' });
    if (!req.user.passwordHash) return res.status(409).json({ message: `Configura una contraseña antes de desconectar ${label}` });

    const account = await models.OAuthAccount.findOne({ where: { userId: req.user.id, provider, active: true } });
    if (!account) return res.status(404).json({ message: `No hay una cuenta de ${label} conectada` });
    await account.update({ active: false });
    await audit(req, { event: `profile.${provider}_disconnected`, category: 'security', userId: req.user.id });
    await notifySecurity(req.user, `Cuenta de ${label} desconectada`, [`Se desconectó ${account.email || `la cuenta de ${label}`} como método de acceso.`]);
    return res.json({ message: `Cuenta de ${label} desconectada` });
  };

  uploadAvatar = async (req, res) => { const mime = String(req.get('content-type') || '').split(';')[0].trim().toLowerCase(); const extension = avatarTypes.get(mime); if (!extension) return res.status(415).json({ message: 'Formato no permitido. Usa JPG, PNG o WEBP' }); if (!Buffer.isBuffer(req.body) || req.body.length === 0) return res.status(400).json({ message: 'No se recibió ninguna imagen' }); await fs.mkdir(avatarDirectory, { recursive: true }); const oldAvatar = req.user.avatarUrl; const fileName = `user_${req.user.id}_${Date.now()}.${extension}`; await fs.writeFile(path.join(avatarDirectory, fileName), req.body); const avatarUrl = `${avatarPublicBase}/${fileName}`; await req.user.update({ avatarUrl }); if (oldAvatar) await removeStoredAvatar(oldAvatar); await audit(req, { event: 'profile.avatar_changed', category: 'user', userId: req.user.id }); return res.json({ avatarUrl, user: await serializeUser(req.user) }); };
  deleteAvatar = async (req, res) => { const oldAvatar = req.user.avatarUrl; if (oldAvatar) await removeStoredAvatar(oldAvatar); await req.user.update({ avatarUrl: null }); await audit(req, { event: 'profile.avatar_removed', category: 'user', userId: req.user.id }); return res.json({ user: await serializeUser(req.user) }); };
  sessions = async (req, res) => res.json({ sessions: await activeSessions(req.user.id, req.session?.id) });
  revokeSession = async (req, res) => { const session = await models.Session.findOne({ where: { id: req.params.id, userId: req.user.id, revokedAt: null } }); if (!session) return res.status(404).json({ message: 'Sesión no encontrada o ya cerrada' }); const current = session.id === req.session?.id; await session.update({ revokedAt: new Date() }); disconnectSessionSockets(req, session.id); await audit(req, { event: 'profile.session_revoked', category: 'security', userId: req.user.id, metadata: { sessionId: session.id, current } }); if (current) clearSessionCookie(res); return res.json({ message: 'Sesión cerrada correctamente', current }); };
  revokeOtherSessions = async (req, res) => { const sessions = await models.Session.findAll({ where: { userId: req.user.id, id: { [Op.ne]: req.session.id }, revokedAt: null }, attributes: ['id'] }); await models.Session.update({ revokedAt: new Date() }, { where: { userId: req.user.id, id: { [Op.ne]: req.session.id }, revokedAt: null } }); sessions.forEach((session) => disconnectSessionSockets(req, session.id)); await audit(req, { event: 'profile.other_sessions_revoked', category: 'security', userId: req.user.id }); return res.json({ message: 'Las demás sesiones fueron cerradas' }); };
  revokeAllSessions = async (req, res) => { await models.Session.update({ revokedAt: new Date() }, { where: { userId: req.user.id, revokedAt: null } }); disconnectUserSockets(req, req.user.id); await revokeTrustedDevices(req.user.id); clearSessionCookie(res); clearTrustedDeviceCookie(res); await audit(req, { event: 'profile.all_sessions_revoked', category: 'security', userId: req.user.id }); return res.json({ message: 'Todas las sesiones fueron cerradas' }); };
}

export const ctrlProfile = new ProfileController();
