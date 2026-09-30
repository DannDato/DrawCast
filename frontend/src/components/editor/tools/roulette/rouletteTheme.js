export const ROULETTE_PALETTES = Object.freeze({
  neon: Object.freeze(['#6C63FF', '#F59E0B', '#22C55E', '#EF4444', '#06B6D4', '#A855F7', '#F97316', '#84CC16', '#3B82F6', '#EC4899']),
  arcade: Object.freeze(['#7C3AED', '#F97316', '#16A34A', '#DC2626', '#0284C7', '#CA8A04', '#DB2777', '#0891B2']),
  mono: Object.freeze(['#111111', '#292929', '#444444', '#606060', '#7A7A7A', '#959595'])
});

export const DEFAULT_ROULETTE_PALETTE = 'neon';
export const DEFAULT_ROULETTE_BASE_COLOR = '#6C63FF';

export function paletteColors(key = DEFAULT_ROULETTE_PALETTE) {
  return ROULETTE_PALETTES[key] || ROULETTE_PALETTES[DEFAULT_ROULETTE_PALETTE];
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function normalizeRouletteColor(value, fallback = DEFAULT_ROULETTE_BASE_COLOR) {
  const raw = String(value || '').trim();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) return `#${short[1].split('').map((part) => part + part).join('').toUpperCase()}`;
  const full = /^#([0-9a-f]{6})$/i.exec(raw);
  return full ? `#${full[1].toUpperCase()}` : fallback;
}

function hexToRgb(hex) {
  const normalized = normalizeRouletteColor(hex);
  return {
    r: parseInt(normalized.slice(1, 3), 16) / 255,
    g: parseInt(normalized.slice(3, 5), 16) / 255,
    b: parseInt(normalized.slice(5, 7), 16) / 255
  };
}

function rgbToHsl({ r, g, b }) {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const delta = max - min;
  let h = 0;
  const l = (max + min) / 2;
  let s = 0;

  if (delta) {
    s = delta / (1 - Math.abs((2 * l) - 1));
    if (max === r) h = 60 * (((g - b) / delta) % 6);
    else if (max === g) h = 60 * (((b - r) / delta) + 2);
    else h = 60 * (((r - g) / delta) + 4);
  }

  return { h: h < 0 ? h + 360 : h, s: s * 100, l: l * 100 };
}

function hslToHex(h, s, l) {
  const saturation = clamp(s, 0, 100) / 100;
  const lightness = clamp(l, 0, 100) / 100;
  const chroma = (1 - Math.abs((2 * lightness) - 1)) * saturation;
  const section = ((h % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  let r = 0;
  let g = 0;
  let b = 0;

  if (section < 1) [r, g] = [chroma, x];
  else if (section < 2) [r, g] = [x, chroma];
  else if (section < 3) [g, b] = [chroma, x];
  else if (section < 4) [g, b] = [x, chroma];
  else if (section < 5) [r, b] = [x, chroma];
  else [r, b] = [chroma, x];

  const m = lightness - (chroma / 2);
  const toHex = (value) => Math.round((value + m) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export function roulettePaletteFromColor(baseColor = DEFAULT_ROULETTE_BASE_COLOR) {
  const base = normalizeRouletteColor(baseColor);
  const { h, s, l } = rgbToHsl(hexToRgb(base));
  const light = hslToHex(h, clamp(s - 7, 0, 100), clamp(l + 18, 18, 88));
  const deep = hslToHex(h, clamp(s + 5, 0, 100), clamp(l - 18, 10, 76));
  return Object.freeze([light, base, deep]);
}
