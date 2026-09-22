const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const MAX_TOKEN_LENGTH = 2048;

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
  const siteKey = String(process.env.CLOUDFLARE_CAPTCHA_KEY || '').trim();
  if (!siteKey) return res.status(503).json({ message: 'Turnstile no está configurado' });
  return res.json({ siteKey });
}

export function verifyTurnstile(expectedAction) {
  return async (req, res, next) => {
    const secret = String(process.env.CLOUDFLARE_CAPTCHA_SECRET || '').trim();
    const token = typeof req.body?.turnstileToken === 'string' ? req.body.turnstileToken.trim() : '';

    if (!secret) return res.status(503).json({ message: 'La verificación anti-bot no está disponible' });
    if (!token || token.length > MAX_TOKEN_LENGTH) return res.status(403).json({ message: 'Completa la verificación anti-bot' });

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch(SITEVERIFY_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: controller.signal,
        body: new URLSearchParams({ secret, response: token, remoteip: clientIp(req) })
      });
      if (!response.ok) return res.status(403).json({ message: 'No fue posible validar la verificación anti-bot' });

      const result = await response.json();
      const hostnames = allowedHostnames();
      if (!result.success || result.action !== expectedAction || !result.hostname || !hostnames.has(result.hostname)) {
        return res.status(403).json({ message: 'La verificación anti-bot no es válida o expiró' });
      }

      return next();
    } catch {
      return res.status(503).json({ message: 'No fue posible completar la verificación anti-bot' });
    } finally {
      clearTimeout(timeout);
    }
  };
}
