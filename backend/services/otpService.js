import crypto from 'node:crypto';
import bcrypt from 'bcrypt';
import { Op } from 'sequelize';
import { env } from '../config/env.js';
import { models } from '../models/index.js';
import { getClientIp } from '../helpers/ip.js';
import { randomToken, safeUserAgent, sha256 } from '../helpers/security.js';
import { sendAccessCodeEmail } from './emailService.js';

function otpCode() {
  return String(crypto.randomInt(100000, 1000000));
}

export function maskEmail(email) {
  const [local = '', domain = ''] = String(email || '').split('@');
  if (!domain) return 'tu correo';
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(2, local.length - visible.length))}@${domain}`;
}

export async function getTrustedDevice(req, userId) {
  const raw = req.cookies?.[env.trustedDeviceCookieName];
  if (!raw) return null;

  const row = await models.TrustedDevice.findOne({
    where: {
      userId,
      tokenHash: sha256(raw),
      revokedAt: null,
      expiresAt: { [Op.gt]: new Date() }
    }
  });

  if (!row) return null;
  return row;
}

export async function rotateTrustedDevice(req, res, user, existingDevice = null) {
  const raw = randomToken(48);
  const expiresAt = new Date(Date.now() + env.trustedDeviceDays * 86400000);
  const values = {
    tokenHash: sha256(raw),
    ip: getClientIp(req),
    userAgent: safeUserAgent(req.get('user-agent')),
    expiresAt,
    lastUsedAt: new Date(),
    revokedAt: null
  };

  if (existingDevice) await existingDevice.update(values);
  else await models.TrustedDevice.create({ userId: user.id, ...values });

  res.cookie(env.trustedDeviceCookieName, raw, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    maxAge: env.trustedDeviceDays * 86400000,
    path: '/'
  });
}

export function clearTrustedDeviceCookie(res) {
  res.clearCookie(env.trustedDeviceCookieName, {
    httpOnly: true,
    secure: env.cookieSecure,
    sameSite: env.cookieSameSite,
    path: '/'
  });
}

export async function revokeTrustedDevices(userId) {
  await models.TrustedDevice.update(
    { revokedAt: new Date() },
    { where: { userId, revokedAt: null } }
  );
}

export async function issueOtpChallenge(req, user) {
  const code = otpCode();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + env.otpMinutes * 60000);

  await models.OtpChallenge.update(
    { consumedAt: now },
    { where: { userId: user.id, consumedAt: null } }
  );

  const challenge = await models.OtpChallenge.create({
    userId: user.id,
    codeHash: await bcrypt.hash(code, env.otpBcryptRounds),
    expiresAt,
    attempts: 0,
    maxAttempts: env.otpMaxAttempts,
    resendCount: 0,
    lastSentAt: now,
    ip: getClientIp(req),
    userAgent: safeUserAgent(req.get('user-agent'))
  });

  try {
    await sendAccessCodeEmail(user.email, code, env.otpMinutes);
  } catch (error) {
    await challenge.destroy();
    throw error;
  }

  return {
    requiresOtp: true,
    challengeId: challenge.id,
    expiresInSeconds: env.otpMinutes * 60,
    resendAvailableInSeconds: env.otpResendSeconds,
    emailHint: maskEmail(user.email)
  };
}

export async function verifyOtpChallenge(challengeId, code) {
  const challenge = await models.OtpChallenge.findByPk(challengeId);

  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    return { ok: false, status: 400, message: 'El código expiró. Vuelve a iniciar sesión.' };
  }

  if (challenge.attempts >= challenge.maxAttempts) {
    return { ok: false, status: 429, message: 'Demasiados intentos. Vuelve a iniciar sesión.' };
  }

  if (!/^\d{6}$/.test(String(code || ''))) {
    return { ok: false, status: 400, message: 'Ingresa el código de 6 dígitos.' };
  }

  const matches = await bcrypt.compare(String(code), challenge.codeHash);
  if (!matches) {
    const attempts = challenge.attempts + 1;
    await challenge.update({ attempts });
    const remaining = Math.max(0, challenge.maxAttempts - attempts);
    return {
      ok: false,
      status: remaining === 0 ? 429 : 400,
      message: remaining === 0 ? 'Demasiados intentos. Vuelve a iniciar sesión.' : `Código incorrecto. Te quedan ${remaining} intento${remaining === 1 ? '' : 's'}.`
    };
  }

  await challenge.update({ consumedAt: new Date() });
  const user = await models.User.findByPk(challenge.userId);
  if (!user || user.statusKey !== 'ACTIVE') return { ok: false, status: 403, message: 'Cuenta no disponible' };

  return { ok: true, user, challenge };
}

export async function resendOtpChallenge(challengeId) {
  const challenge = await models.OtpChallenge.findByPk(challengeId);
  if (!challenge || challenge.consumedAt || challenge.expiresAt <= new Date()) {
    return { ok: false, status: 400, message: 'La verificación expiró. Vuelve a iniciar sesión.' };
  }

  const elapsed = Math.floor((Date.now() - new Date(challenge.lastSentAt).getTime()) / 1000);
  if (elapsed < env.otpResendSeconds) {
    return { ok: false, status: 429, message: `Espera ${env.otpResendSeconds - elapsed} segundos antes de reenviar.`, retryAfter: env.otpResendSeconds - elapsed };
  }

  if (challenge.resendCount >= env.otpMaxResends) {
    return { ok: false, status: 429, message: 'Alcanzaste el máximo de reenvíos. Vuelve a iniciar sesión.' };
  }

  const user = await models.User.findByPk(challenge.userId);
  if (!user || user.statusKey !== 'ACTIVE') return { ok: false, status: 403, message: 'Cuenta no disponible' };

  const code = otpCode();
  await sendAccessCodeEmail(user.email, code, env.otpMinutes);

  const now = new Date();
  await challenge.update({
    codeHash: await bcrypt.hash(code, env.otpBcryptRounds),
    expiresAt: new Date(now.getTime() + env.otpMinutes * 60000),
    attempts: 0,
    resendCount: challenge.resendCount + 1,
    lastSentAt: now
  });

  return { ok: true, resendAvailableInSeconds: env.otpResendSeconds, emailHint: maskEmail(user.email) };
}
