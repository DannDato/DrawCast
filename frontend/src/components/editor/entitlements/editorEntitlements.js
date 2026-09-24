export const EMPTY_CHANNEL_ENTITLEMENTS = Object.freeze({ loaded: false, features: {}, limits: {}, bundles: [] });

export const FEATURE_LABELS = Object.freeze({
  'editor.select': 'Selección',
  'editor.pan': 'Manita',
  'editor.brush': 'Pincel',
  'editor.eraser': 'Borrador',
  'editor.image': 'Imagen / GIF',
  'editor.snap': 'Imán',
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

export const TOOL_FEATURE = Object.freeze({
  select: 'editor.select',
  hand: 'editor.pan',
  draw: 'editor.brush',
  eraser: 'editor.eraser',
  image: 'editor.image',
  text: 'editor.text',
  timer: 'editor.timer',
  line: 'editor.line',
  shape: 'editor.shape'
});

export function normalizeChannelEntitlements(value = {}) {
  return {
    loaded: true,
    features: value?.features && typeof value.features === 'object' ? { ...value.features } : {},
    limits: value?.limits && typeof value.limits === 'object' ? { ...value.limits } : {},
    bundles: Array.isArray(value?.bundles) ? [...value.bundles] : []
  };
}

export function featureEnabled(entitlements, key) {
  return entitlements?.loaded === true && entitlements?.features?.[key] === true;
}

export function entitlementLimit(entitlements, key) {
  const value = Number(entitlements?.limits?.[key] || 0);
  return entitlements?.loaded && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 0;
}

export function objectFeature(object) {
  const type = String(object?.tipo || '').toLowerCase();
  if (type === 'text' || type === 'texto') return 'editor.text';
  if (type === 'timer') return 'editor.timer';
  if (type === 'image' || type === 'imagen') return 'editor.image';
  if (type === 'shape' || type === 'forma') return String(object?.shapeType || object?.shape || '').toLowerCase() === 'line' ? 'editor.line' : 'editor.shape';
  return null;
}
