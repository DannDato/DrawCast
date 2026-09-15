import { OAuth2Client } from 'google-auth-library';
import { Op } from 'sequelize';
import { models } from '../../models/index.js';
import { audit } from '../../helpers/audit.js';
import { randomToken, sha256 } from '../../helpers/security.js';
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  hashPassword,
  verifyPassword,
  serializeUser
} from '../../services/authService.js';
import { applyRolePreset } from '../../helpers/permissions.js';
import { sendPasswordReset } from '../../services/emailService.js';
import { validatePasswordPolicy } from '../../services/passwordPolicy.js';
import { clearLoginFailures, loginAllowed, registerLoginFailure } from '../../services/loginProtectionService.js';
import { notifySecurity } from '../../services/securityNotificationService.js';
import { getSettingBoolean } from '../../services/settingsService.js';
import logger from '../../helpers/winston.js';
import {
  clearTrustedDeviceCookie,
  getTrustedDevice,
  issueOtpChallenge,
  resendOtpChallenge,
  revokeTrustedDevices,
  rotateTrustedDevice,
  verifyOtpChallenge
} from '../../services/otpService.js';

const google = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const DUMMY_PASSWORD_HASH = '$2b$12$5ZMLPKnS0ZfU.H4x6aWvVuITQekqi5N7X2ZLLwTD6.8.oqbMsS14G';

const validEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || ''));
const validPassword = (value) => validatePasswordPolicy(value).ok;
const normalizeEmail = (value) => String(value || '').trim().toLowerCase();
const normalizeLogin = (value) => String(value || '').trim();

async function finishTrustedLogin(req, res, user, trustedDevice = null, event = 'auth.login') {
  if (trustedDevice) await rotateTrustedDevice(req, res, user, trustedDevice);
  const token = await createSession(req, user);
  setSessionCookie(res, token);
  await audit(req, { event, category: 'auth', userId: user.id });
  return res.json({ user: await serializeUser(user) });
}

async function requireOtp(req, res, user, event) {
  const trustedDevice = await getTrustedDevice(req, user.id);
  if (trustedDevice) return finishTrustedLogin(req, res, user, trustedDevice, event);

  const challenge = await issueOtpChallenge(req, user);
  await audit(req, { event: `${event}.otp_required`, category: 'auth', userId: user.id });
  return res.status(202).json(challenge);
}

class AuthController {
  register = async (req, res) => {
    if (!(await getSettingBoolean('auth.registration.enabled', true))) return res.status(403).json({ message: 'El registro público está deshabilitado' });

    const { username, email, password, displayName } = req.body;
    const cleanUsername = String(username || '').trim();
    const cleanEmail = normalizeEmail(email);

    if (!cleanUsername || !validEmail(cleanEmail)) return res.status(400).json({ message: 'Usuario y email válido son obligatorios' });
    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.ok) return res.status(400).json({ message: passwordPolicy.message });

    const exists = await models.User.findOne({
      where: { [Op.or]: [{ username: cleanUsername }, { email: cleanEmail }] }
    });

    if (exists) return res.status(409).json({ message: 'Usuario o email ya registrado' });

    const user = await models.User.create({
      username: cleanUsername,
      email: cleanEmail,
      passwordHash: await hashPassword(password),
      displayName: String(displayName || '').trim() || cleanUsername,
      roleKey: 'USER'
    });

    await applyRolePreset(user.id, 'USER');
    await audit(req, { event: 'auth.register', category: 'auth', userId: user.id });

    const challenge = await issueOtpChallenge(req, user);
    return res.status(202).json(challenge);
  };

  login = async (req, res) => {
    const identifier = normalizeLogin(req.body.login);
    const password = String(req.body.password || '');

    if (!identifier || !password) return res.status(400).json({ message: 'Usuario/email y contraseña son obligatorios' });

    if (!(await loginAllowed(identifier))) {
      await audit(req, { event: 'auth.login_blocked', category: 'auth', status: 'failure' });
      return res.status(429).json({ message: 'Demasiados intentos. Espera unos minutos antes de volver a intentarlo.' });
    }

    const user = await models.User.findOne({
      where: { [Op.or]: [{ username: identifier }, { email: identifier.toLowerCase() }] }
    });

    const passwordMatches = await verifyPassword(password, user?.passwordHash || DUMMY_PASSWORD_HASH);

    if (!user || !passwordMatches) {
      await audit(req, {
        event: 'auth.login',
        category: 'auth',
        status: 'failure',
        metadata: { login: identifier.slice(0, 120) }
      });
      await registerLoginFailure(identifier);
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }

    if (user.statusKey !== 'ACTIVE') return res.status(403).json({ message: 'Cuenta no disponible' });
    await clearLoginFailures(identifier);
    return requireOtp(req, res, user, 'auth.login');
  };

  verifyAccess = async (req, res) => {
    const challengeId = String(req.body.challengeId || '').trim();
    const code = String(req.body.code || '').trim();
    if (!challengeId || !code) return res.status(400).json({ message: 'Código de verificación requerido' });

    const result = await verifyOtpChallenge(challengeId, code);
    if (!result.ok) {
      await audit(req, { event: 'auth.otp_verify', category: 'auth', status: 'failure', userId: result.challenge?.userId || null });
      return res.status(result.status).json({ message: result.message });
    }

    if (!result.user.emailVerifiedAt) await result.user.update({ emailVerifiedAt: new Date() });
    await rotateTrustedDevice(req, res, result.user);

    const token = await createSession(req, result.user);
    setSessionCookie(res, token);
    await audit(req, { event: 'auth.otp_verify', category: 'auth', userId: result.user.id });
    await notifySecurity(result.user, 'Nuevo dispositivo verificado', [`Se verificó un acceso desde ${req.get('user-agent') || 'un dispositivo'}.`]);

    return res.json({ user: await serializeUser(result.user) });
  };

  resendAccessCode = async (req, res) => {
    const challengeId = String(req.body.challengeId || '').trim();
    if (!challengeId) return res.status(400).json({ message: 'Verificación no encontrada' });

    const result = await resendOtpChallenge(challengeId);
    if (!result.ok) return res.status(result.status).json({ message: result.message, retryAfter: result.retryAfter || null });

    await audit(req, { event: 'auth.otp_resend', category: 'auth' });
    return res.json({ message: 'Código reenviado', resendAvailableInSeconds: result.resendAvailableInSeconds, emailHint: result.emailHint });
  };

  me = async (req, res) => res.json({ user: await serializeUser(req.user) });

  logout = async (req, res) => {
    if (req.session) await req.session.update({ revokedAt: new Date() });
    await audit(req, { event: 'auth.logout', category: 'auth' });
    clearSessionCookie(res);
    return res.status(204).end();
  };

  googleConfig = async (req, res) => res.json({ enabled: Boolean(process.env.GOOGLE_CLIENT_ID), clientId: process.env.GOOGLE_CLIENT_ID || null });

  googleAuth = async (req, res) => {
    if (!process.env.GOOGLE_CLIENT_ID) return res.status(503).json({ message: 'Google OAuth no configurado' });

    const { credential } = req.body;
    if (!credential) return res.status(400).json({ message: 'Credencial de Google requerida' });

    const ticket = await google.verifyIdToken({ idToken: credential, audience: process.env.GOOGLE_CLIENT_ID });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email || !payload.email_verified) return res.status(401).json({ message: 'Identidad de Google inválida' });

    const email = normalizeEmail(payload.email);
    let account = await models.OAuthAccount.findOne({ where: { provider: 'google', providerUserId: payload.sub } });
    if (account && !account.active) return res.status(403).json({ message: 'Esta cuenta de Google fue desconectada. Inicia con contraseña y vuelve a conectarla desde tu perfil.' });
    let user = account ? await models.User.findByPk(account.userId) : await models.User.findOne({ where: { email } });

    if (!user) {
      const base = (email.split('@')[0] || 'user').replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 60);
      let username = base || `user${Date.now()}`;
      let suffix = 1;
      while (await models.User.findOne({ where: { username } })) username = `${base}${suffix++}`;

      user = await models.User.create({
        username,
        email,
        displayName: payload.name || username,
        emailVerifiedAt: new Date(),
        roleKey: 'USER'
      });
      await applyRolePreset(user.id, 'USER');
    }

    if (user.statusKey !== 'ACTIVE') return res.status(403).json({ message: 'Cuenta no disponible' });

    if (!account) {
      account = await models.OAuthAccount.create({
        userId: user.id,
        provider: 'google',
        providerUserId: payload.sub,
        email,
        avatarUrl: payload.picture || null
      });
    }

    return requireOtp(req, res, user, 'auth.google');
  };

  forgotPassword = async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const user = await models.User.findOne({ where: { email } });

    if (user) {
      const raw = randomToken();
      await models.PasswordReset.update({ usedAt: new Date() }, { where: { userId: user.id, usedAt: null } });
      await models.PasswordReset.create({
        userId: user.id,
        tokenHash: sha256(raw),
        expiresAt: new Date(Date.now() + Number(process.env.PASSWORD_RESET_MINUTES || 30) * 60000)
      });
      try {
        await sendPasswordReset(user.email, raw);
        await audit(req, { event: 'auth.password_reset_requested', category: 'auth', userId: user.id });
      } catch (error) {
        logger.error('No fue posible enviar el correo de recuperación', { error: error.message, userId: user.id });
      }
    }

    return res.json({ message: 'Si la cuenta existe, se enviaron instrucciones.' });
  };

  resetPassword = async (req, res) => {
    const { token, password } = req.body;
    if (!token) return res.status(400).json({ message: 'Token de recuperación requerido' });
    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.ok) return res.status(400).json({ message: passwordPolicy.message });

    const row = await models.PasswordReset.findOne({
      where: { tokenHash: sha256(token), usedAt: null, expiresAt: { [Op.gt]: new Date() } }
    });
    if (!row) return res.status(400).json({ message: 'Token inválido o expirado' });

    const user = await models.User.findByPk(row.userId);
    if (!user) return res.status(400).json({ message: 'La cuenta asociada ya no existe' });

    const newHash = await hashPassword(password);
    if (!(await verifyPassword(password, newHash))) throw new Error('No fue posible verificar el nuevo hash de contraseña antes de persistirlo');

    await user.update({ passwordHash: newHash });
    if (!(await verifyPassword(password, user.passwordHash))) throw new Error('La contraseña fue procesada pero no pudo verificarse después de persistirla');

    await row.update({ usedAt: new Date() });
    await models.PasswordReset.update({ usedAt: new Date() }, { where: { userId: user.id, usedAt: null } });
    await models.Session.update({ revokedAt: new Date() }, { where: { userId: user.id, revokedAt: null } });
    await revokeTrustedDevices(user.id);
    clearTrustedDeviceCookie(res);

    await audit(req, { event: 'auth.password_reset_completed', category: 'auth', userId: user.id });
    await notifySecurity(user, 'Contraseña restablecida', ['La contraseña de tu cuenta fue restablecida.']);
    return res.json({ message: 'Contraseña actualizada correctamente' });
  };
}

export const ctrlAuth = new AuthController();
