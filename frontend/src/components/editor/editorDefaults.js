const SOFT_WHITE = '#e7e7e7';
const MAX_TIMER_SECONDS = (99 * 3600) + (59 * 60) + 59;

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};
const color = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;
const choice = (value, allowed, fallback) => allowed.includes(value) ? value : fallback;

// Fuente única de defaults del editor. Estos valores son fallback local y también
// representan la forma esperada de las preferencias persistidas por usuario.
export const DEFAULT_EDITOR_PREFERENCES = Object.freeze({
  drawing: Object.freeze({ color: SOFT_WHITE, size: 10, brush: 'pencil', opacity: 1 }),
  shape: Object.freeze({ shapeType: 'square', fillColor: SOFT_WHITE, strokeColor: SOFT_WHITE, strokeWidth: 0, borderRadius: 0 }),
  image: Object.freeze({ borderRadius: 0, opacity: 1 }),
  text: Object.freeze({ fontKey: 'segoe', color: SOFT_WHITE, strokeColor: SOFT_WHITE, strokeWidth: 6, fontSize: 56 }),
  timer: Object.freeze({ timerMode: 'up', startSeconds: 0, limitSeconds: MAX_TIMER_SECONDS, fontKey: 'segoe', color: SOFT_WHITE, finishColor: '#dba367', strokeColor: SOFT_WHITE, strokeWidth: 6, fontSize: 56 }),
  roulette: Object.freeze({ baseColor: '#6c63ff', spinSpeed: 3.5, spinDurationMs: 7000, spinDecay: 0.5, textColor: '#ffffff', centerColor: '#111111', pointerColor: SOFT_WHITE })
});

export function normalizeEditorPreferences(preferences = {}) {
  const drawing = preferences.drawing || {};
  const shape = preferences.shape || {};
  const image = preferences.image || {};
  const text = preferences.text || {};
  const timer = preferences.timer || {};
  const roulette = preferences.roulette || {};
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
      finishColor: color(timer.finishColor, DEFAULT_EDITOR_PREFERENCES.timer.finishColor),
      strokeColor: color(timer.strokeColor, DEFAULT_EDITOR_PREFERENCES.timer.strokeColor),
      strokeWidth: clamp(timer.strokeWidth, 0, 24, DEFAULT_EDITOR_PREFERENCES.timer.strokeWidth),
      fontSize: clamp(timer.fontSize, 5, 400, DEFAULT_EDITOR_PREFERENCES.timer.fontSize)
    },
    roulette: {
      baseColor: color(roulette.baseColor, DEFAULT_EDITOR_PREFERENCES.roulette.baseColor),
      spinSpeed: clamp(roulette.spinSpeed, 0.5, 3.5, DEFAULT_EDITOR_PREFERENCES.roulette.spinSpeed),
      spinDurationMs: Math.round(clamp(roulette.spinDurationMs, 2000, 30000, DEFAULT_EDITOR_PREFERENCES.roulette.spinDurationMs)),
      spinDecay: clamp(roulette.spinDecay, 0.10, 0.90, DEFAULT_EDITOR_PREFERENCES.roulette.spinDecay),
      textColor: color(roulette.textColor, DEFAULT_EDITOR_PREFERENCES.roulette.textColor),
      centerColor: color(roulette.centerColor, DEFAULT_EDITOR_PREFERENCES.roulette.centerColor),
      pointerColor: color(roulette.pointerColor, DEFAULT_EDITOR_PREFERENCES.roulette.pointerColor)
    }
  };
}
