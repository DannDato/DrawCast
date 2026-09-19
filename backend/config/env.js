import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const required = ['DB_HOST', 'DB_NAME', 'DB_USER', 'JWT_SECRET'];

export function validateEnv() {
  const missing = required.filter((key) => !process.env[key]);
  if (missing.length) throw new Error(`Variables de entorno faltantes: ${missing.join(', ')}`);
  if ((process.env.JWT_SECRET || '').length < 32) throw new Error('JWT_SECRET debe tener al menos 32 caracteres.');
  if ((process.env.COOKIE_SAME_SITE || 'lax').toLowerCase() === 'none' && process.env.COOKIE_SECURE !== 'true') throw new Error('COOKIE_SAME_SITE=none requiere COOKIE_SECURE=true.');
  if ((process.env.NODE_ENV || 'development') === 'production' && process.env.COOKIE_SECURE !== 'true') throw new Error('En producción COOKIE_SECURE debe ser true.');
  const origins = String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '').split(',').map((value) => value.trim()).filter(Boolean);
  if (!origins.length) throw new Error('Configura FRONTEND_URL o CORS_ORIGINS con al menos un origen permitido.');
  for (const origin of origins) { try { const url = new URL(origin); if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin.replace(/\/$/, '')) throw new Error(); } catch { throw new Error(`Origen inválido en FRONTEND_URL/CORS_ORIGINS: ${origin}`); } }
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.PORT || 3000),
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
  appName: process.env.APP_NAME || 'Dova',
  trustProxy: process.env.TRUST_PROXY || 'loopback',
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  sessionDays: Number(process.env.SESSION_EXPIRES_DAYS || 30),
  cookieName: process.env.SESSION_COOKIE_NAME || 'app_session',
  cookieSecure: process.env.COOKIE_SECURE === 'true',
  cookieSameSite: process.env.COOKIE_SAME_SITE || 'lax',
  bcryptRounds: Number(process.env.BCRYPT_ROUNDS || 12),
  otpMinutes: Number(process.env.OTP_EXPIRES_MINUTES || 10),
  otpMaxAttempts: Number(process.env.OTP_MAX_ATTEMPTS || 5),
  otpMaxResends: Number(process.env.OTP_MAX_RESENDS || 3),
  otpResendSeconds: Number(process.env.OTP_RESEND_SECONDS || 60),
  otpBcryptRounds: Number(process.env.OTP_BCRYPT_ROUNDS || 10),
  trustedDeviceDays: Number(process.env.TRUSTED_DEVICE_DAYS || 30),
  trustedDeviceCookieName: process.env.TRUSTED_DEVICE_COOKIE_NAME || 'trusted_device',
  googleClientId: process.env.GOOGLE_CLIENT_ID || '',
  twitchClientId: process.env.TWITCH_CLIENT_ID || '',
  twitchClientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  twitchRedirectUri: process.env.TWITCH_REDIRECT_URI || '',
  ipTimeout: Number(process.env.IP_API_TIMEOUT_MS || 1500),
  ipCacheHours: Number(process.env.IP_CACHE_TTL_HOURS || 168)
};
