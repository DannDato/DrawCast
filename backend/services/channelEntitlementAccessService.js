import { resolveChannelEntitlements } from './entitlementCatalogService.js';

const CACHE_TTL_MS = Math.max(1000, Number(process.env.ENTITLEMENT_CACHE_TTL_MS || 3000));
const cache = new Map();

export const CHANNEL_FEATURE_LABELS = Object.freeze({
  'editor.select': 'Selección',
  'editor.pan': 'Manita',
  'editor.brush': 'Pincel',
  'editor.eraser': 'Borrador',
  'editor.image': 'Imagen / GIF',
  'editor.snap': 'Imán y guías de alineación',
  'editor.overlay': 'Overlay',
  'overlay.remove_watermark': 'Sin marca de agua',
  'editor.collaboration': 'Colaboración',
  'editor.guides': 'Guías',
  'editor.designs': 'Diseños',
  'editor.text': 'Texto',
  'editor.live_studio': 'Live / Estudio',
  'editor.quick_sounds': 'Sonidos rápidos',
  'editor.custom_sounds': 'Sonidos personalizados',
  'editor.timer': 'Temporizador',
  'editor.line': 'Línea',
  'editor.shape': 'Forma',
  'editor.launchpad': 'Launchpad'
});

export function publicChannelEntitlements(entitlements = {}) {
  return {
    features: { ...(entitlements.features || {}) },
    limits: { ...(entitlements.limits || {}) },
    bundles: Array.isArray(entitlements.bundles) ? [...entitlements.bundles] : []
  };
}

export async function getChannelEntitlements(channelId, { fresh = false } = {}) {
  const id = Number(channelId);
  if (!Number.isInteger(id) || id <= 0) throw new Error('channelId inválido para resolver entitlements');

  const now = Date.now();
  const cached = cache.get(id);
  if (!fresh && cached && now - cached.at < CACHE_TTL_MS) return cached.value;

  const value = await resolveChannelEntitlements(id);
  cache.set(id, { at: now, value });
  return value;
}

export function invalidateChannelEntitlements(channelId) {
  cache.delete(Number(channelId));
}

export function entitlementError(featureKey, message = null) {
  const label = CHANNEL_FEATURE_LABELS[featureKey] || featureKey;
  return Object.assign(new Error(message || `${label} está bloqueado en este lienzo.`), {
    status: 403,
    code: 'FEATURE_LOCKED',
    feature: featureKey
  });
}

export function limitError(limitKey, limit, message = null) {
  return Object.assign(new Error(message || `Este lienzo llegó a su límite (${limit}).`), {
    status: 409,
    code: 'ENTITLEMENT_LIMIT_REACHED',
    limitKey,
    limit
  });
}

export function hasFeature(entitlements, featureKey) {
  return entitlements?.features?.[featureKey] === true;
}


export function publicOverlayBranding(entitlements = {}) {
  return {
    watermark: !hasFeature(entitlements, 'overlay.remove_watermark')
  };
}

export function getLimit(entitlements, limitKey) {
  const value = Number(entitlements?.limits?.[limitKey] || 0);
  return Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function requireFeatureValue(entitlements, featureKey, message = null) {
  if (!hasFeature(entitlements, featureKey)) throw entitlementError(featureKey, message);
  return true;
}

export function featureForObject(object) {
  const type = String(object?.tipo || '').toLowerCase();
  if (type === 'text' || type === 'texto') return 'editor.text';
  if (type === 'timer') return 'editor.timer';
  if (type === 'image' || type === 'imagen') return 'editor.image';
  if (type === 'shape' || type === 'forma') return String(object?.shapeType || object?.shape || '').toLowerCase() === 'line' ? 'editor.line' : 'editor.shape';
  return null;
}

export function requireObjectFeature(entitlements, object) {
  const featureKey = featureForObject(object);
  if (featureKey) requireFeatureValue(entitlements, featureKey);

  const type = String(object?.tipo || '').toLowerCase();
  if ((type === 'draw' || type === 'trazo') && Array.isArray(object?.lineas)) {
    const modes = new Set(object.lineas.map((stroke) => stroke?.mode || stroke?.modo).filter(Boolean));
    for (const mode of modes) requireDrawModeFeature(entitlements, mode);
  }

  return featureKey;
}

export function requireDrawModeFeature(entitlements, mode) {
  const featureKey = mode === 'erase' || mode === 'borrar' ? 'editor.eraser' : 'editor.brush';
  requireFeatureValue(entitlements, featureKey);
  return featureKey;
}
