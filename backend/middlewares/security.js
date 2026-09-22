import rateLimit from 'express-rate-limit';

const number = (name, fallback) => Number(process.env[name] || fallback);
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export const apiLimiter = rateLimit({ windowMs: number('API_RATE_LIMIT_WINDOW_MS', 60000), limit: number('API_RATE_LIMIT_MAX', 300), standardHeaders: true, legacyHeaders: false });
export const authLimiter = rateLimit({ windowMs: number('AUTH_RATE_LIMIT_WINDOW_MS', 900000), limit: number('AUTH_RATE_LIMIT_MAX', 20), standardHeaders: true, legacyHeaders: false, skipSuccessfulRequests: true });
export const oauthLimiter = rateLimit({ windowMs: number('OAUTH_RATE_LIMIT_WINDOW_MS', 900000), limit: number('OAUTH_RATE_LIMIT_MAX', 30), standardHeaders: true, legacyHeaders: false });
export const authReadLimiter = rateLimit({ windowMs: 60000, limit: number('AUTH_READ_RATE_LIMIT_MAX', 120), standardHeaders: true, legacyHeaders: false });
export const sensitiveAccountLimiter = rateLimit({ windowMs: 900000, limit: number('SENSITIVE_ACCOUNT_RATE_LIMIT_MAX', 20), standardHeaders: true, legacyHeaders: false });
export const mutationLimiter = rateLimit({ windowMs: 60000, limit: number('MUTATION_RATE_LIMIT_MAX', 120), standardHeaders: true, legacyHeaders: false });
export const externalFetchLimiter = rateLimit({ windowMs: 60000, limit: number('EXTERNAL_FETCH_RATE_LIMIT_MAX', 30), standardHeaders: true, legacyHeaders: false });
export const publicMediaLimiter = rateLimit({ windowMs: 60000, limit: number('PUBLIC_MEDIA_RATE_LIMIT_MAX', 180), standardHeaders: true, legacyHeaders: false });
export const usernameAvailabilityLimiter = rateLimit({ windowMs: 60000, limit: 60, standardHeaders: true, legacyHeaders: false });
export const otpLimiter = rateLimit({ windowMs: number('OTP_RATE_LIMIT_WINDOW_MS', 600000), limit: number('OTP_RATE_LIMIT_MAX', 12), standardHeaders: true, legacyHeaders: false });
export const otpResendLimiter = rateLimit({ windowMs: number('OTP_RESEND_RATE_LIMIT_WINDOW_MS', 900000), limit: number('OTP_RESEND_RATE_LIMIT_MAX', 5), standardHeaders: true, legacyHeaders: false });

function allowedOrigins() {
  return new Set(
    String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:5173')
      .split(',')
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean)
  );
}

function normalizeOrigin(value) {
  if (!value) return null;

  try {
    return new URL(value).origin.replace(/\/$/, '');
  } catch {
    return null;
  }
}

/**
 * CSRF protection for cookie-authenticated browser requests.
 *
 * Unsafe requests are accepted only when:
 * - Sec-Fetch-Site is not cross-site, and
 * - Origin (preferred) or Referer belongs to the configured frontend allowlist.
 *
 * Requests without Origin/Referer are rejected by default. This prevents a
 * missing header from silently bypassing the protection. Trusted non-browser
 * clients can be enabled explicitly with ALLOW_ORIGINLESS_REQUESTS=true.
 */
export function verifyBrowserOrigin(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  const fetchSite = String(req.get('sec-fetch-site') || '').toLowerCase();

  if (fetchSite === 'cross-site') {
    return res.status(403).json({ message: 'Solicitud cross-site bloqueada' });
  }

  const origin = normalizeOrigin(req.get('origin'));
  const refererOrigin = normalizeOrigin(req.get('referer'));
  const requestOrigin = origin || refererOrigin;

  if (!requestOrigin) {
    if (process.env.ALLOW_ORIGINLESS_REQUESTS === 'true') return next();
    return res.status(403).json({ message: 'No fue posible validar el origen de la solicitud' });
  }

  if (allowedOrigins().has(requestOrigin)) return next();

  return res.status(403).json({ message: 'Origen no permitido' });
}
