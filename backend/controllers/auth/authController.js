import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
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
import { exchangeGoogleCode, googleCodeFlowConfigured, googleIdentityConfigured, verifyGoogleCredential } from '../../services/googleOAuthService.js';
import logger from '../../helpers/winston.js';
import { env } from '../../config/env.js';
import {
  clearTrustedDeviceCookie,
  getTrustedDevice,
  issueOtpChallenge,
  resendOtpChallenge,
  revokeTrustedDevices,
  rotateTrustedDevice,
  verifyOtpChallenge
} from '../../services/otpService.js';

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


function frontendRedirect(pathname, params = {}) {
  const url = new URL(pathname, process.env.FRONTEND_URL || 'http://localhost:5173');
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function oauthErrorRedirect(message) {
  return frontendRedirect('/login', { oauthError: message });
}

function profileOAuthRedirect(params = {}) {
  return frontendRedirect('/app/profile', params);
}

async function upsertOAuthAccount(req, user, { provider, providerUserId, email, avatarUrl, event }) {
  const occupied = await models.OAuthAccount.findOne({
    where: { provider, providerUserId, userId: { [Op.ne]: user.id }, active: true }
  });
  if (occupied) return { error: `Esa cuenta de ${provider} ya está conectada a otro usuario` };

  let account = await models.OAuthAccount.findOne({ where: { userId: user.id, provider } });
  const values = { providerUserId: String(providerUserId), email: normalizeEmail(email), avatarUrl: avatarUrl || null, active: true };
  if (account) await account.update(values);
  else account = await models.OAuthAccount.create({ userId: user.id, provider, ...values });

  await audit(req, { event, category: 'security', userId: user.id });
  await notifySecurity(user, `Cuenta de ${provider} conectada`, [`Se conectó ${email} como método de acceso.`]);
  return { account };
}

async function getOrCreateOAuthUser({ provider, providerUserId, email, displayName, usernameBase }) {
  let account = await models.OAuthAccount.findOne({ where: { provider, providerUserId } });
  if (account && !account.active) return { account, user: null, inactive: true };

  let user = account ? await models.User.findByPk(account.userId) : await models.User.findOne({ where: { email } });
  if (!user) {
    const rawBase = String(usernameBase || email.split('@')[0] || 'user');
    const base = rawBase.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 60) || `user${Date.now()}`;
    let username = base;
    let suffix = 1;
    while (await models.User.findOne({ where: { username } })) username = `${base}${suffix++}`;

    user = await models.User.create({
      username,
      email,
      displayName: String(displayName || username).slice(0, 120),
      emailVerifiedAt: new Date(),
      roleKey: 'USER'
    });
    await applyRolePreset(user.id, 'USER');
  }

  return { account, user, inactive: false };
}

async function getOAuthSession(req) {
  const token = req.cookies?.[env.cookieName];
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'fullstack-base' });
    const session = await models.Session.findOne({ where: { id: decoded.sid, userId: decoded.sub, tokenHash: sha256(token), revokedAt: null } });
    if (!session || session.expiresAt <= new Date()) return null;
    const user = await models.User.findByPk(decoded.sub);
    if (!user || user.statusKey !== 'ACTIVE') return null;
    await session.update({ lastSeenAt: new Date() });
    return { user, session };
  } catch {
    return null;
  }
}

async function finishOAuthRedirect(req, res, user, event) {
  const trustedDevice = await getTrustedDevice(req, user.id);
  if (trustedDevice) {
    await rotateTrustedDevice(req, res, user, trustedDevice);
    const token = await createSession(req, user);
    setSessionCookie(res, token);
    await audit(req, { event, category: 'auth', userId: user.id });
    return res.redirect(frontendRedirect('/app'));
  }

  const challenge = await issueOtpChallenge(req, user);
  await audit(req, { event: `${event}.otp_required`, category: 'auth', userId: user.id });
  return res.redirect(frontendRedirect('/verify-access', {
    challengeId: challenge.challengeId,
    emailHint: challenge.emailHint,
    resendAvailableInSeconds: challenge.resendAvailableInSeconds
  }));
}

class AuthController {
  register = async (req, res) => {
    if (!(await getSettingBoolean('auth.registration.enabled', true))) return res.status(403).json({ message: 'El registro público está deshabilitado' });

    const { username, email, password, displayName } = req.body;
    const cleanUsername = String(username || '').trim();
    const cleanEmail = normalizeEmail(email);

    if (!cleanUsername || !validEmail(cleanEmail)) return res.status(400).json({ message: 'Usuario y correo válido son obligatorios' });
    const passwordPolicy = validatePasswordPolicy(password);
    if (!passwordPolicy.ok) return res.status(400).json({ message: passwordPolicy.message });

    const exists = await models.User.findOne({
      where: { [Op.or]: [{ username: cleanUsername }, { email: cleanEmail }] }
    });

    if (exists) return res.status(409).json({ message: 'Usuario o correo ya registrado' });

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

    if (!identifier || !password) return res.status(400).json({ message: 'Usuario/correo y contraseña son obligatorios' });

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

  googleConfig = async (req, res) => res.json({ enabled: googleCodeFlowConfigured(), clientId: process.env.GOOGLE_CLIENT_ID || null });

  googleAuth = async (req, res) => {
    if (!googleIdentityConfigured()) return res.status(503).json({ message: 'Google OAuth no configurado' });

    const credential = String(req.body.credential || '');
    if (!credential) return res.status(400).json({ message: 'Credencial de Google requerida' });

    let payload;
    try { payload = await verifyGoogleCredential(credential); }
    catch { return res.status(401).json({ message: 'Identidad de Google inválida' }); }

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


  googleCodeAuth = async (req, res) => {
    if (!googleCodeFlowConfigured()) return res.status(503).json({ message: 'Google OAuth no configurado' });
    if (req.get('x-requested-with') !== 'XmlHttpRequest') return res.status(400).json({ message: 'Solicitud de Google no válida' });

    let payload;
    try { payload = await exchangeGoogleCode(String(req.body.code || '')); }
    catch { return res.status(401).json({ message: 'No se pudo validar la cuenta de Google' }); }

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


  twitchConfig = async (req, res) => res.json({
    enabled: Boolean(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET && process.env.TWITCH_REDIRECT_URI)
  });

  twitchStart = async (req, res) => {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET || !process.env.TWITCH_REDIRECT_URI) {
      return res.redirect(oauthErrorRedirect('Twitch OAuth no está configurado en el servidor.'));
    }

    const nonce = randomToken();
    const connectMode = String(req.query.mode || '').trim().toLowerCase() === 'connect';
    let statePayload = { provider: 'twitch', nonce };
    if (connectMode) {
      const auth = await getOAuthSession(req);
      if (!auth) return res.redirect(profileOAuthRedirect({ oauthError: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' }));
      statePayload = { ...statePayload, mode: 'connect', userId: auth.user.id, sessionId: auth.session.id };
    }
    const state = jwt.sign(statePayload, env.jwtSecret, { expiresIn: '10m' });
    res.cookie('twitch_oauth_state', nonce, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth/twitch/callback'
    });
    const params = new URLSearchParams({
      client_id: process.env.TWITCH_CLIENT_ID,
      redirect_uri: process.env.TWITCH_REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read:email',
      state
    });
    return res.redirect(`https://id.twitch.tv/oauth2/authorize?${params.toString()}`);
  };

  twitchCallback = async (req, res) => {
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET || !process.env.TWITCH_REDIRECT_URI) {
      return res.redirect(oauthErrorRedirect('Twitch OAuth no está configurado en el servidor.'));
    }

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const providerError = String(req.query.error_description || req.query.error || '');
    if (providerError) return res.redirect(oauthErrorRedirect(providerError));
    if (!code || !state) return res.redirect(oauthErrorRedirect('Respuesta OAuth de Twitch incompleta.'));

    let oauthPayload;
    try {
      const payload = jwt.verify(state, env.jwtSecret);
      oauthPayload = payload;
      const cookieNonce = String(req.cookies?.twitch_oauth_state || '');
      if (payload?.provider !== 'twitch' || !cookieNonce || payload.nonce !== cookieNonce) throw new Error('OAuth state mismatch');
      if (oauthPayload?.mode === 'connect') {
        const auth = await getOAuthSession(req);
        if (!auth || auth.user.id !== oauthPayload.userId || auth.session.id !== oauthPayload.sessionId) throw new Error('OAuth session mismatch');
      }
      res.clearCookie('twitch_oauth_state', { path: '/api/auth/twitch/callback' });
    } catch {
      res.clearCookie('twitch_oauth_state', { path: '/api/auth/twitch/callback' });
      return res.redirect(oauthErrorRedirect('La sesión OAuth de Twitch expiró o no es válida.'));
    }

    try {
      const tokenParams = new URLSearchParams({
        client_id: process.env.TWITCH_CLIENT_ID,
        client_secret: process.env.TWITCH_CLIENT_SECRET,
        code,
        grant_type: 'authorization_code',
        redirect_uri: process.env.TWITCH_REDIRECT_URI
      });
      const tokenResponse = await fetch(`https://id.twitch.tv/oauth2/token?${tokenParams.toString()}`, { method: 'POST' });
      if (!tokenResponse.ok) throw new Error(`Twitch token exchange failed (${tokenResponse.status})`);
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) throw new Error('Twitch access token missing');

      const userResponse = await fetch('https://api.twitch.tv/helix/users', {
        headers: {
          'Client-Id': process.env.TWITCH_CLIENT_ID,
          Authorization: `Bearer ${tokenData.access_token}`
        }
      });
      if (!userResponse.ok) throw new Error(`Twitch user lookup failed (${userResponse.status})`);
      const userData = await userResponse.json();
      const twitchUser = userData?.data?.[0];
      if (!twitchUser?.id) throw new Error('Twitch identity missing');

      const email = normalizeEmail(twitchUser.email);
      if (!validEmail(email)) return res.redirect(oauthErrorRedirect('Twitch no devolvió un correo válido. Revisa que tu cuenta tenga un correo disponible.'));

      let account = await models.OAuthAccount.findOne({ where: { provider: 'twitch', providerUserId: twitchUser.id } });
      if (oauthPayload?.mode === 'connect') {
        const auth = await getOAuthSession(req);
        if (!auth) return res.redirect(profileOAuthRedirect({ oauthError: 'Tu sesión expiró mientras conectabas Twitch.' }));
        if (account && account.userId !== auth.user.id) return res.redirect(profileOAuthRedirect({ oauthError: 'Esa cuenta de Twitch ya está conectada a otro usuario.' }));
        if (!account) {
          account = await models.OAuthAccount.create({ userId: auth.user.id, provider: 'twitch', providerUserId: twitchUser.id, email, avatarUrl: twitchUser.profile_image_url || null, active: true });
        } else {
          await account.update({ email, avatarUrl: twitchUser.profile_image_url || null, active: true });
        }
        await audit(req, { event: 'profile.twitch_connected', category: 'security', userId: auth.user.id });
        await notifySecurity(auth.user, 'Cuenta de Twitch conectada', [`Se conectó ${email} como método de acceso.`]);
        return res.redirect(profileOAuthRedirect({ oauth: 'connected', provider: 'twitch' }));
      }

      if (account && !account.active) return res.redirect(oauthErrorRedirect('Esta cuenta de Twitch fue desconectada. Inicia con contraseña y vuelve a conectarla desde tu perfil.'));
      let user = account ? await models.User.findByPk(account.userId) : await models.User.findOne({ where: { email } });

      if (!user) {
        const rawBase = twitchUser.login || email.split('@')[0] || 'user';
        const base = rawBase.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 60) || `user${Date.now()}`;
        let username = base;
        let suffix = 1;
        while (await models.User.findOne({ where: { username } })) username = `${base}${suffix++}`;

        user = await models.User.create({
          username,
          email,
          displayName: twitchUser.display_name || username,
          roleKey: 'USER'
        });
        await applyRolePreset(user.id, 'USER');
      }

      if (user.statusKey !== 'ACTIVE') return res.redirect(oauthErrorRedirect('Cuenta no disponible.'));

      if (!account) {
        account = await models.OAuthAccount.create({
          userId: user.id,
          provider: 'twitch',
          providerUserId: twitchUser.id,
          email,
          avatarUrl: twitchUser.profile_image_url || null
        });
      }

      return finishOAuthRedirect(req, res, user, 'auth.twitch');
    } catch (error) {
      logger.error('Twitch OAuth failed', { error: error.message });
      return res.redirect(oauthErrorRedirect('No se pudo continuar con Twitch.'));
    }
  };

  kickConfig = async (req, res) => res.json({
    enabled: Boolean(process.env.KICK_CLIENT_ID && process.env.KICK_CLIENT_SECRET && process.env.KICK_REDIRECT_URI)
  });

  kickStart = async (req, res) => {
    if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET || !process.env.KICK_REDIRECT_URI) {
      return res.redirect(oauthErrorRedirect('Kick OAuth no está configurado en el servidor.'));
    }

    const nonce = randomToken();
    const codeVerifier = randomToken(64);
    const connectMode = String(req.query.mode || '').trim().toLowerCase() === 'connect';
    let statePayload = { provider: 'kick', nonce };
    if (connectMode) {
      const auth = await getOAuthSession(req);
      if (!auth) return res.redirect(profileOAuthRedirect({ oauthError: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' }));
      statePayload = { ...statePayload, mode: 'connect', userId: auth.user.id, sessionId: auth.session.id };
    }

    const state = jwt.sign(statePayload, env.jwtSecret, { expiresIn: '10m' });
    const codeChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth/kick/callback'
    };
    res.cookie('kick_oauth_state', nonce, cookieOptions);
    res.cookie('kick_oauth_verifier', codeVerifier, cookieOptions);

    const params = new URLSearchParams({
      client_id: process.env.KICK_CLIENT_ID,
      redirect_uri: process.env.KICK_REDIRECT_URI,
      response_type: 'code',
      scope: 'user:read',
      state,
      code_challenge: codeChallenge,
      code_challenge_method: 'S256'
    });
    return res.redirect(`https://id.kick.com/oauth/authorize?${params.toString()}`);
  };

  kickCallback = async (req, res) => {
    if (!process.env.KICK_CLIENT_ID || !process.env.KICK_CLIENT_SECRET || !process.env.KICK_REDIRECT_URI) {
      return res.redirect(oauthErrorRedirect('Kick OAuth no está configurado en el servidor.'));
    }

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const providerError = String(req.query.error_description || req.query.error || '');
    if (providerError) return res.redirect(oauthErrorRedirect(providerError));
    if (!code || !state) return res.redirect(oauthErrorRedirect('Respuesta OAuth de Kick incompleta.'));

    let oauthPayload;
    try {
      oauthPayload = jwt.verify(state, env.jwtSecret);
      const cookieNonce = String(req.cookies?.kick_oauth_state || '');
      if (oauthPayload?.provider !== 'kick' || !cookieNonce || oauthPayload.nonce !== cookieNonce) throw new Error('OAuth state mismatch');
      if (oauthPayload?.mode === 'connect') {
        const auth = await getOAuthSession(req);
        if (!auth || auth.user.id !== oauthPayload.userId || auth.session.id !== oauthPayload.sessionId) throw new Error('OAuth session mismatch');
      }
    } catch {
      res.clearCookie('kick_oauth_state', { path: '/api/auth/kick/callback' });
      res.clearCookie('kick_oauth_verifier', { path: '/api/auth/kick/callback' });
      return res.redirect(oauthErrorRedirect('La sesión OAuth de Kick expiró o no es válida.'));
    }

    try {
      const codeVerifier = String(req.cookies?.kick_oauth_verifier || '');
      if (!codeVerifier) throw new Error('Kick PKCE verifier missing');
      const tokenResponse = await fetch('https://id.kick.com/oauth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.KICK_CLIENT_ID,
          client_secret: process.env.KICK_CLIENT_SECRET,
          redirect_uri: process.env.KICK_REDIRECT_URI,
          code_verifier: codeVerifier,
          code
        })
      });
      if (!tokenResponse.ok) throw new Error(`Kick token exchange failed (${tokenResponse.status})`);
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) throw new Error('Kick access token missing');

      const userResponse = await fetch('https://api.kick.com/public/v1/users', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!userResponse.ok) throw new Error(`Kick user lookup failed (${userResponse.status})`);
      const userData = await userResponse.json();
      const kickUser = Array.isArray(userData?.data) ? userData.data[0] : userData?.data;
      if (!kickUser?.user_id || !validEmail(kickUser.email)) throw new Error('Kick no devolvió una identidad válida');

      const email = normalizeEmail(kickUser.email);
      if (oauthPayload?.mode === 'connect') {
        const auth = await getOAuthSession(req);
        if (!auth) return res.redirect(profileOAuthRedirect({ oauthError: 'Tu sesión expiró mientras conectabas Kick.' }));
        const result = await upsertOAuthAccount(req, auth.user, {
          provider: 'kick', providerUserId: kickUser.user_id, email,
          avatarUrl: kickUser.profile_picture,
          event: 'profile.kick_connected'
        });
        if (result.error) return res.redirect(profileOAuthRedirect({ oauthError: result.error }));
        return res.redirect(profileOAuthRedirect({ oauth: 'connected', provider: 'kick' }));
      }

      const result = await getOrCreateOAuthUser({
        provider: 'kick', providerUserId: kickUser.user_id, email,
        displayName: kickUser.name, usernameBase: email.split('@')[0]
      });
      if (result.inactive) return res.redirect(oauthErrorRedirect('Esta cuenta de Kick fue desconectada. Inicia con contraseña y vuelve a conectarla desde tu perfil.'));
      const user = result.user;
      if (!user || user.statusKey !== 'ACTIVE') return res.redirect(oauthErrorRedirect('Cuenta no disponible.'));

      if (!result.account) {
        await models.OAuthAccount.create({ userId: user.id, provider: 'kick', providerUserId: String(kickUser.user_id), email, avatarUrl: kickUser.profile_picture || null });
      }
      return finishOAuthRedirect(req, res, user, 'auth.kick');
    } catch (error) {
      logger.error('Kick OAuth failed', { error: error.message });
      return res.redirect(oauthErrorRedirect('No se pudo continuar con Kick.'));
    } finally {
      res.clearCookie('kick_oauth_state', { path: '/api/auth/kick/callback' });
      res.clearCookie('kick_oauth_verifier', { path: '/api/auth/kick/callback' });
    }
  };

  discordConfig = async (req, res) => res.json({
    enabled: Boolean(process.env.DISCORD_CLIENT_ID && process.env.DISCORD_CLIENT_SECRET && process.env.DISCORD_REDIRECT_URI)
  });

  discordStart = async (req, res) => {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
      return res.redirect(oauthErrorRedirect('Discord OAuth no está configurado en el servidor.'));
    }

    const nonce = randomToken();
    const connectMode = String(req.query.mode || '').trim().toLowerCase() === 'connect';
    let statePayload = { provider: 'discord', nonce };
    if (connectMode) {
      const auth = await getOAuthSession(req);
      if (!auth) return res.redirect(profileOAuthRedirect({ oauthError: 'Tu sesión ya no es válida. Inicia sesión de nuevo.' }));
      statePayload = { ...statePayload, mode: 'connect', userId: auth.user.id, sessionId: auth.session.id };
    }

    const state = jwt.sign(statePayload, env.jwtSecret, { expiresIn: '10m' });
    res.cookie('discord_oauth_state', nonce, {
      httpOnly: true,
      secure: process.env.COOKIE_SECURE === 'true',
      sameSite: process.env.COOKIE_SAME_SITE || 'lax',
      maxAge: 10 * 60 * 1000,
      path: '/api/auth/discord/callback'
    });
    const params = new URLSearchParams({
      client_id: process.env.DISCORD_CLIENT_ID,
      redirect_uri: process.env.DISCORD_REDIRECT_URI,
      response_type: 'code',
      scope: 'identify email',
      state
    });
    return res.redirect(`https://discord.com/oauth2/authorize?${params.toString()}`);
  };

  discordCallback = async (req, res) => {
    if (!process.env.DISCORD_CLIENT_ID || !process.env.DISCORD_CLIENT_SECRET || !process.env.DISCORD_REDIRECT_URI) {
      return res.redirect(oauthErrorRedirect('Discord OAuth no está configurado en el servidor.'));
    }

    const code = String(req.query.code || '');
    const state = String(req.query.state || '');
    const providerError = String(req.query.error_description || req.query.error || '');
    if (providerError) return res.redirect(oauthErrorRedirect(providerError));
    if (!code || !state) return res.redirect(oauthErrorRedirect('Respuesta OAuth de Discord incompleta.'));

    let oauthPayload;
    try {
      oauthPayload = jwt.verify(state, env.jwtSecret);
      const cookieNonce = String(req.cookies?.discord_oauth_state || '');
      if (oauthPayload?.provider !== 'discord' || !cookieNonce || oauthPayload.nonce !== cookieNonce) throw new Error('OAuth state mismatch');
      if (oauthPayload?.mode === 'connect') {
        const auth = await getOAuthSession(req);
        if (!auth || auth.user.id !== oauthPayload.userId || auth.session.id !== oauthPayload.sessionId) throw new Error('OAuth session mismatch');
      }
    } catch {
      res.clearCookie('discord_oauth_state', { path: '/api/auth/discord/callback' });
      return res.redirect(oauthErrorRedirect('La sesión OAuth de Discord expiró o no es válida.'));
    }

    try {
      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          client_id: process.env.DISCORD_CLIENT_ID,
          client_secret: process.env.DISCORD_CLIENT_SECRET,
          redirect_uri: process.env.DISCORD_REDIRECT_URI,
          code
        })
      });
      if (!tokenResponse.ok) throw new Error(`Discord token exchange failed (${tokenResponse.status})`);
      const tokenData = await tokenResponse.json();
      if (!tokenData.access_token) throw new Error('Discord access token missing');

      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` }
      });
      if (!userResponse.ok) throw new Error(`Discord user lookup failed (${userResponse.status})`);
      const discordUser = await userResponse.json();
      if (!discordUser?.id || !validEmail(discordUser.email) || discordUser.verified === false) throw new Error('Discord no devolvió una identidad válida con correo verificado');

      const email = normalizeEmail(discordUser.email);
      const avatarUrl = discordUser.avatar ? `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png` : null;
      const displayName = discordUser.global_name || discordUser.username || email.split('@')[0];

      if (oauthPayload?.mode === 'connect') {
        const auth = await getOAuthSession(req);
        if (!auth) return res.redirect(profileOAuthRedirect({ oauthError: 'Tu sesión expiró mientras conectabas Discord.' }));
        const result = await upsertOAuthAccount(req, auth.user, {
          provider: 'discord', providerUserId: discordUser.id, email,
          avatarUrl, event: 'profile.discord_connected'
        });
        if (result.error) return res.redirect(profileOAuthRedirect({ oauthError: result.error }));
        return res.redirect(profileOAuthRedirect({ oauth: 'connected', provider: 'discord' }));
      }

      const result = await getOrCreateOAuthUser({
        provider: 'discord', providerUserId: discordUser.id, email,
        displayName, usernameBase: discordUser.username
      });
      if (result.inactive) return res.redirect(oauthErrorRedirect('Esta cuenta de Discord fue desconectada. Inicia con contraseña y vuelve a conectarla desde tu perfil.'));
      const user = result.user;
      if (!user || user.statusKey !== 'ACTIVE') return res.redirect(oauthErrorRedirect('Cuenta no disponible.'));

      if (!result.account) {
        await models.OAuthAccount.create({ userId: user.id, provider: 'discord', providerUserId: discordUser.id, email, avatarUrl });
      }
      return finishOAuthRedirect(req, res, user, 'auth.discord');
    } catch (error) {
      logger.error('Discord OAuth failed', { error: error.message });
      return res.redirect(oauthErrorRedirect('No se pudo continuar con Discord.'));
    } finally {
      res.clearCookie('discord_oauth_state', { path: '/api/auth/discord/callback' });
    }
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
