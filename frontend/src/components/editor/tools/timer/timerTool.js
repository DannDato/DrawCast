import { normalizeTextConfig, resolveTextFontFamily } from '../text/textTool';
import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';

export const MAX_TIMER_SECONDS = (99 * 3600) + (59 * 60) + 59;

export const DEFAULT_TIMER_CONFIG = {
  timerMode: 'up',
  startSeconds: 0,
  limitSeconds: MAX_TIMER_SECONDS,
  color: DEFAULT_EDITOR_PREFERENCES.colors.timer,
  strokeColor: DEFAULT_EDITOR_PREFERENCES.colors.timerStroke,
  strokeWidth: 6,
  fontSize: 56,
  fontKey: 'segoe',
  fontFamily: resolveTextFontFamily('segoe')
};

export function parseHmsToSeconds(raw, fallbackSeconds = 0) {
  const text = String(raw || '').trim();
  const match = text.match(/^(\d{1,2}):(\d{1,2}):(\d{1,2})$/);
  if (!match) return fallbackSeconds;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  if (minutes > 59 || seconds > 59) return fallbackSeconds;

  return Math.max(0, (hours * 3600) + (minutes * 60) + seconds);
}

export function formatSecondsAsHms(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export function normalizeTimerConfig(config = {}) {
  const timerMode = config.timerMode === 'down' || config.mode === 'down' ? 'down' : 'up';
  const startSeconds = Math.max(0, Math.min(MAX_TIMER_SECONDS, Number(config.startSeconds ?? config.baseSeconds) || 0));
  const fallbackLimit = timerMode === 'down' ? 0 : MAX_TIMER_SECONDS;
  const rawLimit = Number.isFinite(Number(config.limitSeconds)) ? Number(config.limitSeconds) : fallbackLimit;
  const limitSeconds = timerMode === 'down'
    ? Math.max(0, Math.min(startSeconds, rawLimit))
    : Math.min(MAX_TIMER_SECONDS, Math.max(startSeconds, rawLimit));
  const textConfig = normalizeTextConfig(config);

  return {
    timerMode,
    startSeconds,
    limitSeconds,
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

export function timerIsStillRunning(timer, nowMs = Date.now()) {
  if (!timer || !(timer.timerRunning ?? timer.running)) return false;
  const config = normalizeTimerConfig(timer);
  const current = getTimerCurrentSeconds(timer, nowMs);
  return config.timerMode === 'down' ? current > config.limitSeconds : current < config.limitSeconds;
}

export function toggleTimer(timer, nowMs = Date.now()) {
  const current = getTimerCurrentSeconds(timer, nowMs);
  const running = Boolean(timer.timerRunning ?? timer.running);

  return {
    ...timer,
    timerCurrentSeconds: current,
    timerResumeSeconds: current,
    timerRunning: !running,
    running: undefined,
    startedAtMs: running ? null : nowMs,
    startedAt: undefined
  };
}

export function adjustTimerSeconds(timer, deltaSeconds, nowMs = Date.now()) {
  const config = normalizeTimerConfig(timer);
  const current = getTimerCurrentSeconds(timer, nowMs);
  const minAllowed = config.timerMode === 'down' ? config.limitSeconds : config.startSeconds;
  const maxAllowed = config.timerMode === 'down' ? config.startSeconds : config.limitSeconds;
  const next = Math.max(minAllowed, Math.min(maxAllowed, current + Number(deltaSeconds || 0)));
  const running = Boolean(timer.timerRunning ?? timer.running);

  return {
    ...timer,
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
