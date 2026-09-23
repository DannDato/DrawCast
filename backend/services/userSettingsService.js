import { models } from '../models/index.js';

const EDITOR_KEY = 'editor.defaults';
const SOUND_SLOTS_KEY = 'editor.soundSlots';
const LAUNCHPAD_SLOTS_KEY = 'editor.launchpadSlots';
const SOUND_SLOT_COUNT = 5;
const LAUNCHPAD_SLOT_COUNT = 24;
const SOFT_WHITE = '#e7e7e7';
const MAX_TIMER_SECONDS = (99 * 3600) + (59 * 60) + 59;

export const DEFAULT_EDITOR_PREFERENCES = Object.freeze({
  drawing: Object.freeze({ color: SOFT_WHITE, size: 10, brush: 'pencil', opacity: 1 }),
  shape: Object.freeze({ shapeType: 'square', fillColor: SOFT_WHITE, strokeColor: SOFT_WHITE, strokeWidth: 0, borderRadius: 0 }),
  image: Object.freeze({ borderRadius: 0, opacity: 1 }),
  text: Object.freeze({ fontKey: 'segoe', color: SOFT_WHITE, strokeColor: SOFT_WHITE, strokeWidth: 6, fontSize: 56 }),
  timer: Object.freeze({ timerMode: 'up', startSeconds: 0, limitSeconds: MAX_TIMER_SECONDS, fontKey: 'segoe', color: SOFT_WHITE, strokeColor: SOFT_WHITE, strokeWidth: 6, fontSize: 56 })
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

export function normalizeEditorPreferences(preferences = {}) {
  const drawing = preferences.drawing || {};
  const shape = preferences.shape || {};
  const image = preferences.image || {};
  const text = preferences.text || {};
  const timer = preferences.timer || {};
  const timerMode = choice(timer.timerMode, ['up', 'down'], DEFAULT_EDITOR_PREFERENCES.timer.timerMode);
  const startSeconds = Math.round(clamp(timer.startSeconds, 0, MAX_TIMER_SECONDS, DEFAULT_EDITOR_PREFERENCES.timer.startSeconds));
  const rawLimit = Math.round(clamp(timer.limitSeconds, 0, MAX_TIMER_SECONDS, DEFAULT_EDITOR_PREFERENCES.timer.limitSeconds));

  return {
    drawing: {
      color: color(drawing.color, DEFAULT_EDITOR_PREFERENCES.drawing.color),
      size: Math.round(clamp(drawing.size, 2, 100, DEFAULT_EDITOR_PREFERENCES.drawing.size)),
      brush: choice(drawing.brush, ['pencil', 'marker', 'highlighter'], DEFAULT_EDITOR_PREFERENCES.drawing.brush),
      opacity: clamp(drawing.opacity, 0.05, 1, DEFAULT_EDITOR_PREFERENCES.drawing.opacity)
    },
    shape: {
      shapeType: choice(shape.shapeType, ['square', 'circle', 'triangle', 'star'], DEFAULT_EDITOR_PREFERENCES.shape.shapeType),
      fillColor: color(shape.fillColor, DEFAULT_EDITOR_PREFERENCES.shape.fillColor),
      strokeColor: color(shape.strokeColor, DEFAULT_EDITOR_PREFERENCES.shape.strokeColor),
      strokeWidth: clamp(shape.strokeWidth, 0, 24, DEFAULT_EDITOR_PREFERENCES.shape.strokeWidth),
      borderRadius: clamp(shape.borderRadius, 0, 200, DEFAULT_EDITOR_PREFERENCES.shape.borderRadius)
    },
    image: {
      borderRadius: clamp(image.borderRadius, 0, 300, DEFAULT_EDITOR_PREFERENCES.image.borderRadius),
      opacity: clamp(image.opacity, 0, 1, DEFAULT_EDITOR_PREFERENCES.image.opacity)
    },
    text: {
      fontKey: choice(text.fontKey, ['segoe', 'bebas', 'outfit', 'montserrat'], DEFAULT_EDITOR_PREFERENCES.text.fontKey),
      color: color(text.color, DEFAULT_EDITOR_PREFERENCES.text.color),
      strokeColor: color(text.strokeColor, DEFAULT_EDITOR_PREFERENCES.text.strokeColor),
      strokeWidth: clamp(text.strokeWidth, 0, 24, DEFAULT_EDITOR_PREFERENCES.text.strokeWidth),
      fontSize: clamp(text.fontSize, 5, 400, DEFAULT_EDITOR_PREFERENCES.text.fontSize)
    },
    timer: {
      timerMode,
      startSeconds,
      limitSeconds: timerMode === 'down' ? Math.min(startSeconds, rawLimit) : Math.max(startSeconds, rawLimit),
      fontKey: choice(timer.fontKey, ['segoe', 'bebas', 'outfit', 'montserrat'], DEFAULT_EDITOR_PREFERENCES.timer.fontKey),
      color: color(timer.color, DEFAULT_EDITOR_PREFERENCES.timer.color),
      strokeColor: color(timer.strokeColor, DEFAULT_EDITOR_PREFERENCES.timer.strokeColor),
      strokeWidth: clamp(timer.strokeWidth, 0, 24, DEFAULT_EDITOR_PREFERENCES.timer.strokeWidth),
      fontSize: clamp(timer.fontSize, 5, 400, DEFAULT_EDITOR_PREFERENCES.timer.fontSize)
    }
  };
}


function normalizeSoundSlotArray(value = [], count = SOUND_SLOT_COUNT) {
  const source = Array.isArray(value) ? value : [];
  return Array.from({ length: count }, (_, index) => {
    const id = typeof source[index] === 'string' ? source[index].trim() : '';
    if (!id || id.length > 180 || !id.toLowerCase().endsWith('.mp3') || id.includes('/') || id.includes('\\') || /[\0-\x1f\x7f]/.test(id)) return null;
    return id;
  });
}

const normalizeSoundSlots = (value = []) => normalizeSoundSlotArray(value, SOUND_SLOT_COUNT);
const normalizeLaunchpadSlots = (value = []) => normalizeSoundSlotArray(value, LAUNCHPAD_SLOT_COUNT);

function parseValue(value, fallback = {}) {
  try { return JSON.parse(value); } catch { return fallback; }
}

export async function getUserSettings(userId) {
  const rows = await models.UserSetting.findAll({ where: { userId } });
  const byKey = new Map(rows.map((row) => [row.key, parseValue(row.value)]));
  return {
    editor: normalizeEditorPreferences(byKey.get(EDITOR_KEY) || {}),
    soundSlots: byKey.has(SOUND_SLOTS_KEY) ? normalizeSoundSlots(byKey.get(SOUND_SLOTS_KEY)) : null,
    launchpadSlots: byKey.has(LAUNCHPAD_SLOTS_KEY) ? normalizeLaunchpadSlots(byKey.get(LAUNCHPAD_SLOTS_KEY)) : null
  };
}

export async function saveEditorPreferences(userId, preferences) {
  const editor = normalizeEditorPreferences(preferences);
  await models.UserSetting.upsert({ userId, key: EDITOR_KEY, value: JSON.stringify(editor) });
  return editor;
}

export async function resetEditorPreferences(userId) {
  await models.UserSetting.destroy({ where: { userId, key: EDITOR_KEY } });
  return normalizeEditorPreferences({});
}


export async function saveSoundSlots(userId, slots) {
  const soundSlots = normalizeSoundSlots(slots);
  await models.UserSetting.upsert({ userId, key: SOUND_SLOTS_KEY, value: JSON.stringify(soundSlots) });
  return soundSlots;
}


export async function saveLaunchpadSlots(userId, slots) {
  const launchpadSlots = normalizeLaunchpadSlots(slots);
  await models.UserSetting.upsert({ userId, key: LAUNCHPAD_SLOTS_KEY, value: JSON.stringify(launchpadSlots) });
  return launchpadSlots;
}
