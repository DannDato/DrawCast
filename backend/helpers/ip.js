import { Op } from 'sequelize';
import { models } from '../models/index.js';
import logger from './winston.js';
import { env } from '../config/env.js';

function normalizeIp(value = '') {
  let ip = String(value).trim();
  if (ip.startsWith('::ffff:')) ip = ip.slice(7);
  return ip.slice(0, 64);
}
export function getClientIp(req) { return normalizeIp(req.ip || req.socket?.remoteAddress || ''); }
export function isPrivateIp(ip) {
  return !ip || ip === '::1' || ip === '127.0.0.1' || ip.startsWith('10.') || ip.startsWith('192.168.') || /^172\.(1[6-9]|2\d|3[01])\./.test(ip) || ip.startsWith('fc') || ip.startsWith('fd') || ip.startsWith('fe80:');
}
export async function enrichIp(ip) {
  const cleanIp = normalizeIp(ip);
  if (isPrivateIp(cleanIp) || !process.env.IP_API_KEY) return { ip: cleanIp };
  try {
    const validAfter = new Date(Date.now() - env.ipCacheHours * 3600000);
    const cached = await models.IpCache.findOne({ where: { ip: cleanIp, updatedAt: { [Op.gt]: validAfter } } });
    if (cached) return cached.toJSON();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), env.ipTimeout);
    const url = `https://ipapi.co/${encodeURIComponent(cleanIp)}/json/?key=${encodeURIComponent(process.env.IP_API_KEY)}`;
    const response = await fetch(url, { signal: controller.signal, headers: { 'User-Agent': 'fullstack-base/1.0' } });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`IP provider HTTP ${response.status}`);
    const data = await response.json();
    const payload = {
      ip: cleanIp,
      country: data.country_name || null,
      countryCode: data.country_code || null,
      region: data.region || null,
      city: data.city || null,
      organization: data.org || null,
      asn: data.asn || null,
      timezone: data.timezone || null,
      latitude: data.latitude ?? null,
      longitude: data.longitude ?? null,
      provider: 'ipapi'
    };
    await models.IpCache.upsert(payload);
    return payload;
  } catch (error) {
    logger.warn('IP enrichment failed', { error: error.message, ip: cleanIp });
    return { ip: cleanIp };
  }
}
