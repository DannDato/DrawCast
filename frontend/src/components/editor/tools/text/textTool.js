export const TEXT_FONTS = [
  { key: 'segoe', label: 'Segoe UI (Predeterminada)', family: "'Segoe UI', sans-serif" },
  { key: 'bebas', label: 'Bebas Neue', family: "'Bebas Neue', sans-serif" },
  { key: 'outfit', label: 'Outfit', family: "'Outfit', sans-serif" },
  { key: 'montserrat', label: 'Montserrat', family: "'Montserrat', sans-serif" }
];

export const DEFAULT_TEXT_CONFIG = {
  fontKey: 'segoe',
  fontFamily: "'Segoe UI', sans-serif",
  color: '#ffffff',
  strokeColor: '#000000',
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

export function measureTextBounds(value, config = DEFAULT_TEXT_CONFIG) {
  const normalized = normalizeTextConfig(config);
  const lines = String(value || '').split(/\r?\n/);
  const longest = Math.max(1, ...lines.map((line) => line.length));
  const lineHeight = normalized.fontSize * 1.18;

  return {
    w: Math.max(200, longest * normalized.fontSize * 0.6),
    h: Math.max(normalized.fontSize * 1.5, lines.length * lineHeight)
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
