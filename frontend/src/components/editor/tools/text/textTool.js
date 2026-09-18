import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';
export const TEXT_FONTS = [
  { key: 'segoe', label: 'Segoe UI (Predeterminada)', family: "'Segoe UI', sans-serif" },
  { key: 'bebas', label: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
  { key: 'outfit', label: 'Outfit', family: "'Outfit', sans-serif" },
  { key: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" }
];

export const DEFAULT_TEXT_CONFIG = {
  fontKey: 'segoe',
  fontFamily: "'Segoe UI', sans-serif",
  color: DEFAULT_EDITOR_PREFERENCES.colors.text,
  strokeColor: DEFAULT_EDITOR_PREFERENCES.colors.textStroke,
  strokeWidth: 6,
  fontSize: 56
};

export function resolveTextFontFamily(fontKey) {
  return TEXT_FONTS.find((font) => font.key === fontKey)?.family || DEFAULT_TEXT_CONFIG.fontFamily;
}

export function inferTextFontKey(object = {}) {
  if (typeof object.fontKey === 'string' && TEXT_FONTS.some((font) => font.key === object.fontKey)) return object.fontKey;

  const family = String(object.fontFamily || object.font || '').toLowerCase();
  if (family.includes('bebas')) return 'bebas';
  if (family.includes('outfit')) return 'outfit';
  if (family.includes('montserrat')) return 'montserrat';
  return 'segoe';
}

export function normalizeTextConfig(config = {}) {
  const fontKey = config.fontKey || inferTextFontKey(config);
  const fontSize = Math.max(5, Math.min(400, Number(config.fontSize) || DEFAULT_TEXT_CONFIG.fontSize));
  const rawStrokeWidth = config.strokeWidth ?? config.strokeSize ?? DEFAULT_TEXT_CONFIG.strokeWidth;
  const strokeWidth = Math.max(0, Math.min(24, Number(rawStrokeWidth) || 0));

  return {
    fontKey,
    fontFamily: config.fontFamily || resolveTextFontFamily(fontKey),
    color: config.color || DEFAULT_TEXT_CONFIG.color,
    strokeColor: config.strokeColor || config.stroke || DEFAULT_TEXT_CONFIG.strokeColor,
    strokeWidth,
    fontSize
  };
}

export function textValue(object = {}) {
  return String(object.text ?? object.texto ?? '');
}

export function textLayerName(value, fallback = 'TEXTO') {
  const clean = String(value || '').replace(/\s+/g, ' ').trim();
  return clean || fallback;
}

let measureContext = null;

function getMeasureContext() {
  if (measureContext || typeof document === 'undefined') return measureContext;
  measureContext = document.createElement('canvas').getContext('2d');
  return measureContext;
}

export function measureTextBounds(value, config = DEFAULT_TEXT_CONFIG) {
  const normalized = normalizeTextConfig(config);
  const lines = String(value || '').split(/\r?\n/);
  const lineHeight = normalized.fontSize * 1.18;
  const context = getMeasureContext();

  let width = Math.max(1, ...lines.map((line) => Math.max(1, line.length) * normalized.fontSize * 0.6));
  if (context) {
    context.font = `900 ${normalized.fontSize}px ${normalized.fontFamily}`;
    width = Math.max(1, ...lines.map((line) => context.measureText(line || ' ').width));
  }

  return {
    w: Math.max(8, Math.ceil(width + normalized.strokeWidth)),
    h: Math.max(8, Math.ceil(lines.length * lineHeight + (normalized.strokeWidth / 2)))
  };
}

export function textConfigFromObject(object = {}) {
  return normalizeTextConfig(object);
}

export function applyTextStyle(object, patch = {}) {
  const config = normalizeTextConfig({ ...object, ...patch });
  const value = textValue(object);
  const bounds = measureTextBounds(value, config);

  return {
    ...object,
    ...config,
    ...bounds
  };
}

export function updateTextContent(object, value, configPatch = {}) {
  const config = normalizeTextConfig({ ...object, ...configPatch });
  const bounds = measureTextBounds(value, config);

  return {
    ...object,
    ...config,
    ...bounds,
    text: value,
    texto: undefined,
    layerName: textLayerName(value, object.layerName || 'TEXTO')
  };
}
