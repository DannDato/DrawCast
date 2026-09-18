import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';
export const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
export const DEFAULT_IMAGE_CONFIG = Object.freeze({ ...DEFAULT_EDITOR_PREFERENCES.image });

export function validateImageFile(file) {
  if (!file) return 'No se recibió archivo.';
  if (!ALLOWED_IMAGE_TYPES.has(file.type)) return 'Solo PNG, JPG, WEBP y GIF.';
  if (file.size > MAX_IMAGE_BYTES) return 'La imagen supera el límite de 20 MB.';
  return null;
}

export function getImageKind(mimeType = '', name = '') {
  if (mimeType === 'image/gif' || /\.gif$/i.test(name)) return 'gif';
  return 'image';
}

export function imageLayerName(name = '', mimeType = '') {
  const clean = String(name || '').trim();
  if (clean) return clean;
  return getImageKind(mimeType, name) === 'gif' ? 'GIF' : 'IMAGEN';
}

export function fitImageSize(naturalWidth, naturalHeight, maxWidth = 640, maxHeight = 520) {
  const width = Math.max(1, Number(naturalWidth) || 400);
  const height = Math.max(1, Number(naturalHeight) || 300);
  const scale = Math.min(1, maxWidth / width, maxHeight / height);

  return {
    w: Math.max(8, Math.round(width * scale)),
    h: Math.max(8, Math.round(height * scale))
  };
}

export function loadImageMetadata(url) {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve({ naturalWidth: image.naturalWidth || 400, naturalHeight: image.naturalHeight || 300 });
    image.onerror = () => resolve({ naturalWidth: 400, naturalHeight: 300 });
    image.src = url;
  });
}

export function clampImageConfig(config = {}) {
  return {
    borderRadius: Math.max(0, Math.min(300, Number(config.borderRadius ?? config.radius) || DEFAULT_IMAGE_CONFIG.borderRadius)),
    opacity: Math.max(0, Math.min(1, Number.isFinite(Number(config.opacity)) ? Number(config.opacity) : DEFAULT_IMAGE_CONFIG.opacity))
  };
}
