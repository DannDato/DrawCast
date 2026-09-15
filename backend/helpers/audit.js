import { models } from '../models/index.js';
import logger from './winston.js';
import { enrichIp, getClientIp } from './ip.js';
import { safeUserAgent } from './security.js';

const forbidden = /password|passwd|authorization|cookie|token|secret|credential/i;
function sanitize(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(sanitize);
  if (typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([k]) => !forbidden.test(k)).map(([k, v]) => [k, sanitize(v)]));
  return typeof value === 'string' ? value.slice(0, 2000) : value;
}
export async function audit(req, { event, category = 'system', status = 'success', targetType = null, targetId = null, metadata = null, userId = null } = {}) {
  const ip = getClientIp(req);
  const base = { event, category, status, targetType, targetId: targetId ? String(targetId) : null, metadata: sanitize(metadata), userId: userId ?? req.user?.id ?? null, ip, userAgent: safeUserAgent(req.get('user-agent')) };
  // Persist first with available information; enrich asynchronously and never block the request on the provider.
  try {
    const row = await models.AuditLog.create(base);
    setImmediate(async () => {
      try {
        const info = await enrichIp(ip);
        await row.update({ country: info.country || null, region: info.region || null, city: info.city || null, organization: info.organization || null, asn: info.asn || null, timezone: info.timezone || null });
      } catch (error) { logger.warn('Audit enrichment update failed', { error: error.message }); }
    });
    return row;
  } catch (error) { logger.error('Audit persistence failed', { error: error.message, event }); return null; }
}
