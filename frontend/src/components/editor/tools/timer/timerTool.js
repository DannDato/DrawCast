import { normalizeTextConfig, resolveTextFontFamily } from '../text/textTool';
import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';

export const MAX_TIMER_SECONDS = (99 * 3600) + (59 * 60) + 59;
export const TIMER_FINISH_ANIMATION_MS = 900;

export const DEFAULT_TIMER_CONFIG = {
  timerMode: DEFAULT_EDITOR_PREFERENCES.timer.timerMode,
  startSeconds: DEFAULT_EDITOR_PREFERENCES.timer.startSeconds,
  limitSeconds: DEFAULT_EDITOR_PREFERENCES.timer.limitSeconds,
  color: DEFAULT_EDITOR_PREFERENCES.timer.color,
  finishColor: DEFAULT_EDITOR_PREFERENCES.timer.finishColor,
  strokeColor: DEFAULT_EDITOR_PREFERENCES.timer.strokeColor,
  strokeWidth: DEFAULT_EDITOR_PREFERENCES.timer.strokeWidth,
  fontSize: DEFAULT_EDITOR_PREFERENCES.timer.fontSize,
  fontKey: DEFAULT_EDITOR_PREFERENCES.timer.fontKey,
  fontFamily: resolveTextFontFamily(DEFAULT_EDITOR_PREFERENCES.timer.fontKey)
};

const clampSeconds = (value) => Math.max(0, Math.min(MAX_TIMER_SECONDS, Number(value) || 0));

function normalizeTimerRange(timerMode, rawStart, rawLimit) {
  let startSeconds = clampSeconds(rawStart);
  let limitSeconds = clampSeconds(rawLimit);

  if (timerMode === 'down') {
    if (startSeconds <= limitSeconds) {
      if (startSeconds === 0) startSeconds = 300;
      limitSeconds = 0;
    }
    return { startSeconds, limitSeconds };
  }

  if (limitSeconds <= startSeconds) {
    if (startSeconds >= MAX_TIMER_SECONDS) startSeconds = 0;
    limitSeconds = MAX_TIMER_SECONDS;
  }
  return { startSeconds, limitSeconds };
}
const validColor = (value, fallback) => /^#[0-9a-f]{6}$/i.test(String(value || '')) ? String(value).toLowerCase() : fallback;

export function parseHmsToSeconds(raw, fallbackSeconds = 0) {
  const text = String(raw || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallbackSeconds;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return fallbackSeconds;

  return clampSeconds((hours * 3600) + (minutes * 60) + seconds);
}

export function formatSecondsAsHms(totalSeconds) {
  const safe = clampSeconds(Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeTimerConfig(config = {}) {
  const timerMode = config.timerMode === 'down' || config.mode === 'down' ? 'down' : 'up';
  const rawStart = config.startSeconds ?? config.baseSeconds;
  const fallbackLimit = timerMode === 'down' ? 0 : MAX_TIMER_SECONDS;
  const rawLimit = Number.isFinite(Number(config.limitSeconds)) ? Number(config.limitSeconds) : fallbackLimit;
  const { startSeconds, limitSeconds } = normalizeTimerRange(timerMode, rawStart, rawLimit);
  const textConfig = normalizeTextConfig(config);

  return {
    timerMode,
    startSeconds,
    limitSeconds,
    finishColor: validColor(config.finishColor, DEFAULT_EDITOR_PREFERENCES.timer.finishColor),
    ...textConfig
  };
}

export function timerBounds(config = DEFAULT_TIMER_CONFIG) {
  const normalized = normalizeTimerConfig(config);
  return {
    w: Math.max(260, normalized.fontSize * 4.8),
    h: normalized.fontSize * 1.5
  };
}

export function getTimerCurrentSeconds(timer, nowMs = Date.now()) {
  if (!timer) return 0;

  const config = normalizeTimerConfig(timer);
  const running = Boolean(timer.timerRunning ?? timer.running);
  const fallbackCurrent = Number.isFinite(timer.timerCurrentSeconds)
    ? timer.timerCurrentSeconds
    : Number.isFinite(timer.baseSeconds)
      ? timer.baseSeconds
      : config.startSeconds;

  if (!running) {
    return config.timerMode === 'down'
      ? Math.max(config.limitSeconds, Math.min(config.startSeconds, fallbackCurrent))
      : Math.min(config.limitSeconds, Math.max(config.startSeconds, fallbackCurrent));
  }

  const resumeSeconds = Number.isFinite(timer.timerResumeSeconds) ? timer.timerResumeSeconds : fallbackCurrent;
  const startedAtMs = Number.isFinite(timer.startedAtMs)
    ? timer.startedAtMs
    : Number.isFinite(timer.startedAt)
      ? timer.startedAt
      : nowMs;
  const elapsed = Math.max(0, Math.floor((nowMs - startedAtMs) / 1000));

  if (config.timerMode === 'down') return Math.max(config.limitSeconds, resumeSeconds - elapsed);
  return Math.min(config.limitSeconds, resumeSeconds + elapsed);
}

export function getTimerText(timer, nowMs = Date.now()) {
  return formatSecondsAsHms(getTimerCurrentSeconds(timer, nowMs));
}

export function timerHasReachedEnd(timer, nowMs = Date.now()) {
  if (!timer) return false;
  const config = normalizeTimerConfig(timer);
  const current = getTimerCurrentSeconds(timer, nowMs);
  return config.timerMode === 'down' ? current <= config.limitSeconds : current >= config.limitSeconds;
}

export function timerIsStillRunning(timer, nowMs = Date.now()) {
  return Boolean(timer?.timerRunning ?? timer?.running) && !timerHasReachedEnd(timer, nowMs);
}

export function getTimerCompletionAtMs(timer) {
  if (!timer || !(timer.timerRunning ?? timer.running)) return null;
  const startedAtMs = Number.isFinite(timer.startedAtMs)
    ? timer.startedAtMs
    : Number.isFinite(timer.startedAt)
      ? timer.startedAt
      : null;
  if (!Number.isFinite(startedAtMs)) return null;

  const config = normalizeTimerConfig(timer);
  const resumeSeconds = Number.isFinite(timer.timerResumeSeconds)
    ? timer.timerResumeSeconds
    : Number.isFinite(timer.timerCurrentSeconds)
      ? timer.timerCurrentSeconds
      : config.startSeconds;
  const remaining = config.timerMode === 'down'
    ? Math.max(0, resumeSeconds - config.limitSeconds)
    : Math.max(0, config.limitSeconds - resumeSeconds);

  return startedAtMs + (remaining * 1000);
}

export function getTimerFinishAnimationProgress(timer, nowMs = Date.now()) {
  const completedAt = getTimerCompletionAtMs(timer);
  if (!Number.isFinite(completedAt)) return null;
  const elapsed = nowMs - completedAt;
  if (elapsed < 0 || elapsed > TIMER_FINISH_ANIMATION_MS) return null;
  return Math.max(0, Math.min(1, elapsed / TIMER_FINISH_ANIMATION_MS));
}

export function timerHasFinishAnimation(timer, nowMs = Date.now()) {
  return getTimerFinishAnimationProgress(timer, nowMs) !== null;
}

export function toggleTimer(timer, nowMs = Date.now()) {
  const current = getTimerCurrentSeconds(timer, nowMs);
  const running = Boolean(timer.timerRunning ?? timer.running);
  const config = normalizeTimerConfig(timer);
  const reachedEnd = timerHasReachedEnd(timer, nowMs);
  const nextCurrent = !running && reachedEnd ? config.startSeconds : current;

  return {
    ...timer,
    timerCurrentSeconds: nextCurrent,
    timerResumeSeconds: nextCurrent,
    timerRunning: !running,
    running: undefined,
    startedAtMs: running ? null : nowMs,
    startedAt: undefined
  };
}

export function restartTimer(timer, nowMs = Date.now()) {
  const config = normalizeTimerConfig(timer);
  const running = Boolean(timer.timerRunning ?? timer.running);
  return {
    ...timer,
    timerCurrentSeconds: config.startSeconds,
    timerResumeSeconds: config.startSeconds,
    timerRunning: running,
    running: undefined,
    startedAtMs: running ? nowMs : null,
    startedAt: undefined
  };
}

export function adjustTimerSeconds(timer, deltaSeconds, nowMs = Date.now()) {
  const config = normalizeTimerConfig(timer);
  const current = getTimerCurrentSeconds(timer, nowMs);
  const next = clampSeconds(current + Number(deltaSeconds || 0));
  const running = Boolean(timer.timerRunning ?? timer.running);

  // Los ajustes rápidos modifican tiempo real, no sólo el cursor dentro del
  // rango original. Si hace falta, extendemos INICIO/FINAL para que +tiempo
  // nunca quede bloqueado por un límite viejo o degenerado.
  const startSeconds = config.timerMode === 'down'
    ? Math.max(config.startSeconds, next)
    : Math.min(config.startSeconds, next);
  const limitSeconds = config.timerMode === 'down'
    ? Math.min(config.limitSeconds, next)
    : Math.max(config.limitSeconds, next);

  return {
    ...timer,
    startSeconds,
    limitSeconds,
    timerCurrentSeconds: next,
    timerResumeSeconds: next,
    timerRunning: running,
    running: undefined,
    startedAtMs: running ? nowMs : null,
    startedAt: undefined
  };
}

export function applyTimerConfig(timer, patch = {}, nowMs = Date.now()) {
  const current = getTimerCurrentSeconds(timer, nowMs);
  const config = normalizeTimerConfig({ ...timer, ...patch });
  const bounds = timerBounds(config);
  const clampedCurrent = config.timerMode === 'down'
    ? Math.max(config.limitSeconds, Math.min(config.startSeconds, current))
    : Math.min(config.limitSeconds, Math.max(config.startSeconds, current));
  const running = Boolean(timer.timerRunning ?? timer.running);

  return {
    ...timer,
    ...config,
    ...bounds,
    mode: undefined,
    baseSeconds: undefined,
    running: undefined,
    timerCurrentSeconds: clampedCurrent,
    timerResumeSeconds: clampedCurrent,
    timerRunning: running,
    startedAtMs: running ? nowMs : null,
    startedAt: undefined
  };
}
