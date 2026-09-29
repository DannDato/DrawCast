const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;

function envFlag(name, defaultValue = false) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || String(raw).trim() === '') return defaultValue;
  return ['1', 'true', 'yes', 'on'].includes(String(raw).trim().toLowerCase());
}

function turnstileEnabled() {
  return envFlag('TURNSTILE_ENABLED', true);
}

function loginFailOpenEnabled() {
  return envFlag('TURNSTILE_LOGIN_FAIL_OPEN', true);
}

function allowedHostnames() {
  return new Set(
    String(process.env.CORS_ORIGINS || process.env.FRONTEND_URL || '')
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        try { return new URL(value).hostname; } catch { return null; }
      })
      .filter(Boolean)
  );
}

function clientIp(req) {
  return req.ip || req.socket?.remoteAddress || '';
}

export function turnstileConfig(req, res) {
  const enabled = turnstileEnabled();
  const loginFailOpen = loginFailOpenEnabled();
  const siteKey = String(process.env.CLOUDFLARE_CAPTCHA_KEY || '').trim();

  if (!enabled) return res.json({ enabled: false, loginFailOpen });
  if (!siteKey) return res.status(503).json({ enabled: true, loginFailOpen, message: 'Turnstile no está configurado' });
  return res.json({ enabled: true, loginFailOpen, siteKey });
}

export function verifyTurnstile(expectedAction, { allowLoginFailOpen = false } = {}) {
  return async (req, res, next) => {
    if (!turnstileEnabled()) return next();

    const failOpen = allowLoginFailOpen && loginFailOpenEnabled();
    const secret = String(process.env.CLOUDFLARE_CAPTCHA_SECRET || '').trim();
    const token = typeof req.body?.turnstileToken === 'string' ? req.body.turnstileToken.trim() : '';

    // Fail-open is deliberately restricted to password login. Other protected
    // flows remain fail-closed even when Turnstile/Cloudflare is unavailable.
    if (!secret) {
      if (failOpen) return next();
      return res.status(503).json({ message: 'La verificación anti-bot no está disponible' });
    }

    if (!token) {
      if (failOpen) return next();
      return res.status(403).json({ message: 'Completa la verificación anti-bot' });
    }
    if (token.length > MAX_TOKEN_LENGTH) return res.status(403).json({ message: 'La verificación anti-bot no es válida' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
        body: new URLSearchParams({ secret, response: token, remoteip: clientIp(req) })
      });

      // HTTP/network failures are availability failures, not a negative captcha
      // verdict. Login may fail open only when explicitly configured to do so.
      if (!response.ok) {
        if (failOpen) return next();
        return res.status(503).json({ message: 'No fue posible validar la verificación anti-bot' });
      }

      const result = await response.json();
      const hostnames = allowedHostnames();

      // A real Cloudflare verdict is NEVER bypassed by fail-open. If Cloudflare
      // says the token is bad, expired, for another action, or from another host,
      // reject it even on /login.
      if (!result.success || result.action !== expectedAction || !result.hostname || !hostnames.has(result.hostname)) {
        return res.status(403).json({ message: 'La verificación anti-bot no es válida o expiró' });
      }

      return next();
    } catch {
      if (failOpen) return next();
      return res.status(503).json({ message: 'No fue posible completar la verificación anti-bot' });
    } finally {
      clearTimeout(timeout);
    }
  };
}
