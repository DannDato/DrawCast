import { models } from '../models/index.js';

const cache = new Map();
const TTL_MS = 10000;

const readCached = (key) => {
  const row = cache.get(key);
  if (!row || row.expiresAt < Date.now()) return undefined;
  return row.value;
};

const writeCached = (key, value) => cache.set(key, { value, expiresAt: Date.now() + TTL_MS });

export const clearSettingsCache = () => cache.clear();

export async function getSetting(key, fallback = null) {
  const cached = readCached(key);
  if (cached !== undefined) return cached;
  const row = await models.SystemSetting.findByPk(key);
  const value = row ? row.value : fallback;
  writeCached(key, value);
  return value;
}

export async function getSettingBoolean(key, fallback = false) {
  const value = await getSetting(key, fallback ? 'true' : 'false');
  return ['1', 'true', 'yes', 'on'].includes(String(value).trim().toLowerCase());
}

export async function getSettingNumber(key, fallback = 0) {
  const value = Number(await getSetting(key, fallback));
  return Number.isFinite(value) ? value : fallback;
}

export async function getPublicSettings() {
  const rows = await models.SystemSetting.findAll({ where: { public: true }, order: [['key', 'ASC']] });
  return Object.fromEntries(rows.map((row) => [row.key, row.value]));
}
