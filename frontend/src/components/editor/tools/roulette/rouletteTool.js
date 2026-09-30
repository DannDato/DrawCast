import { DEFAULT_EDITOR_PREFERENCES } from '../../editorDefaults';
import { DEFAULT_ROULETTE_BASE_COLOR, paletteColors, roulettePaletteFromColor, DEFAULT_ROULETTE_PALETTE, normalizeRouletteColor } from './rouletteTheme';

export const DEFAULT_ROULETTE_CONFIG = Object.freeze({
  entriesText: 'Opción 1\nOpción 2\nOpción 3\nOpción 4\nOpción 5\nOpción 6',
  palette: DEFAULT_ROULETTE_PALETTE,
  baseColor: DEFAULT_EDITOR_PREFERENCES.roulette.baseColor || DEFAULT_ROULETTE_BASE_COLOR,
  spinSpeed: DEFAULT_EDITOR_PREFERENCES.roulette.spinSpeed,
  spinDurationMs: DEFAULT_EDITOR_PREFERENCES.roulette.spinDurationMs,
  spinDecay: DEFAULT_EDITOR_PREFERENCES.roulette.spinDecay,
  textColor: DEFAULT_EDITOR_PREFERENCES.roulette.textColor,
  strokeColor: '#111111',
  strokeWidth: 2,
  centerColor: DEFAULT_EDITOR_PREFERENCES.roulette.centerColor,
  pointerColor: DEFAULT_EDITOR_PREFERENCES.roulette.pointerColor,
  rouletteMuted: false
});

const clamp = (value, min, max, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(min, Math.min(max, number)) : fallback;
};

const normalizeDecay = (value) => {
  const number = Number(value);
  if (!Number.isFinite(number)) return DEFAULT_ROULETTE_CONFIG.spinDecay;
  // Compatibilidad con ruletas creadas antes del patch 143 (escala 1.2–6).
  if (number > 1) return Math.max(0.10, Math.min(0.90, 0.10 + ((number - 1.2) / 4.8) * 0.80));
  return Math.max(0.10, Math.min(0.90, number));
};

export function rouletteEntries(value) {
  const source = Array.isArray(value) ? value.join('\n') : String(value || '');
  return source.split(/\r?\n/).map((line) => line.trim()).filter(Boolean).slice(0, 100);
}

export function normalizeRouletteConfig(value = {}) {
  const config = { ...DEFAULT_ROULETTE_CONFIG, ...value };
  const rawEntriesText = Array.isArray(config.entries)
    ? config.entries.join('\n')
    : typeof config.entriesText === 'string'
      ? config.entriesText
      : DEFAULT_ROULETTE_CONFIG.entriesText;
  const baseColor = typeof value?.baseColor === 'string'
    ? normalizeRouletteColor(value.baseColor, null)
    : null;
  return {
    ...config,
    entriesText: rawEntriesText.slice(0, 8000),
    palette: paletteColors(config.palette) ? config.palette : DEFAULT_ROULETTE_PALETTE,
    baseColor,
    spinSpeed: clamp(config.spinSpeed, 0.5, 3.5, DEFAULT_ROULETTE_CONFIG.spinSpeed),
    spinDurationMs: Math.round(clamp(config.spinDurationMs, 2000, 30000, DEFAULT_ROULETTE_CONFIG.spinDurationMs)),
    spinDecay: normalizeDecay(config.spinDecay),
    strokeWidth: clamp(config.strokeWidth, 0, 12, DEFAULT_ROULETTE_CONFIG.strokeWidth),
    rouletteMuted: Boolean(config.rouletteMuted)
  };
}

export function makeRouletteDraft(x, y, size, config = {}) {
  const normalized = normalizeRouletteConfig({ ...DEFAULT_ROULETTE_CONFIG, ...config });
  return {
    tipo: 'roulette',
    x,
    y,
    w: size,
    h: size,
    rotation: 0,
    ...normalized
  };
}

export function buildRouletteFromDrag(start, end, config = {}, fromCenter = false) {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const size = Math.max(120, Math.max(Math.abs(dx), Math.abs(dy)));
  let x;
  let y;
  if (fromCenter) {
    x = start.x - size;
    y = start.y - size;
    return makeRouletteDraft(x, y, size * 2, config);
  }
  x = dx >= 0 ? start.x : start.x - size;
  y = dy >= 0 ? start.y : start.y - size;
  return makeRouletteDraft(x, y, size, config);
}

function modulo(value, base) {
  return ((value % base) + base) % base;
}

export function rouletteIsAnimating(roulette, nowMs = Date.now()) {
  if (!roulette?.rouletteRunning) return false;
  const startedAt = Number(roulette.rouletteStartedAtMs);
  const duration = Number(roulette.rouletteSpinDurationMs || roulette.spinDurationMs);
  if (!Number.isFinite(startedAt) || !Number.isFinite(duration)) return false;
  return nowMs <= startedAt + duration + 150;
}


export const ROULETTE_RESULT_REVEAL_MS = 1400;
export const ROULETTE_RESULT_DISPLAY_MS = 10000;

export function rouletteResultElapsedMs(roulette, nowMs = Date.now()) {
  if (!rouletteWinnerAtRotation(roulette)) return null;
  const startedAt = Number(roulette.rouletteStartedAtMs);
  const duration = Number(roulette.rouletteSpinDurationMs || roulette.spinDurationMs);
  if (!Number.isFinite(startedAt) || !Number.isFinite(duration)) return null;
  const elapsed = nowMs - (startedAt + duration);
  return elapsed >= 0 ? elapsed : null;
}

export function rouletteResultRevealProgress(roulette, nowMs = Date.now()) {
  const elapsed = rouletteResultElapsedMs(roulette, nowMs);
  if (elapsed == null || elapsed > ROULETTE_RESULT_DISPLAY_MS) return null;
  return Math.max(0, Math.min(1, elapsed / ROULETTE_RESULT_REVEAL_MS));
}

export function rouletteNeedsAnimationFrame(roulette, nowMs = Date.now()) {
  if (rouletteIsAnimating(roulette, nowMs)) return true;
  const elapsed = rouletteResultElapsedMs(roulette, nowMs);
  if (elapsed == null) return false;
  if (elapsed < ROULETTE_RESULT_REVEAL_MS) return true;
  // El loop de escena sigue evaluándose aunque no repinte. Abrimos una pequeña
  // ventana al cumplir 10 s para forzar el frame que limpia el ganador del centro.
  return elapsed >= ROULETTE_RESULT_DISPLAY_MS - 80 && elapsed <= ROULETTE_RESULT_DISPLAY_MS + 160;
}

function releaseMultiplier(decay) {
  const normalized = normalizeDecay(decay);
  const unit = Math.max(0, Math.min(1, (normalized - 0.10) / 0.80));
  // Patch 148: conservamos el mismo rango visual (10–90%), pero ampliamos
  // todavía más la cola útil. La respuesta sigue siendo exponencial para que
  // el extremo alto tenga muchísimo drama sin volver torpe la zona media.
  // 10% = 1.0x · 50% ~= 2.65x · 90% = 7.0x.
  return Math.pow(7, unit);
}

const ROULETTE_LAUNCH_DURATION_MS = 850;
const ROULETTE_RELEASE_BASE_MS = 4300;

function smoothstep01(value) {
  const t = Math.max(0, Math.min(1, value));
  return (3 * t * t) - (2 * t * t * t);
}

function launchDistanceTurns(progress, durationSeconds, startVelocity, targetVelocity) {
  const u = Math.max(0, Math.min(1, progress));
  // Integral de una transición smoothstep de velocidad. Arranca y termina
  // con aceleración 0, así que enlaza sin tirones con reposo/sustain.
  const blendIntegral = (u * u * u) - (0.5 * u * u * u * u);
  return durationSeconds * ((startVelocity * u) + ((targetVelocity - startVelocity) * blendIntegral));
}

function releaseDistanceTurns(progress, durationSeconds, entryVelocity) {
  const u = Math.max(0, Math.min(1, progress));
  // v(u) = 1 - smootherstep(u), con smootherstep = 6u^5 - 15u^4 + 10u^3.
  // Además de conservar velocidad y aceleración continuas al salir del sustain,
  // también hace que el jerk sea 0 en ambos extremos. En la práctica el release
  // entra casi plano, empieza a ceder poco a poco y muere sin ningún 'tope'.
  const u2 = u * u;
  const u3 = u2 * u;
  const u4 = u3 * u;
  const u5 = u4 * u;
  const u6 = u5 * u;
  const integral = u - u6 + (3 * u5) - (2.5 * u4);
  return entryVelocity * durationSeconds * integral;
}

export function rouletteReleaseMultiplier(rouletteOrDecay) {
  const value = typeof rouletteOrDecay === 'object'
    ? rouletteOrDecay?.rouletteSpinDecay ?? rouletteOrDecay?.spinDecay
    : rouletteOrDecay;
  return releaseMultiplier(value);
}

export function getRouletteRotation(roulette, nowMs = Date.now()) {
  const start = Number(roulette?.rouletteStartRotation) || 0;
  const end = Number(roulette?.rouletteEndRotation);
  const startedAt = Number(roulette?.rouletteStartedAtMs);
  const totalDuration = Math.max(1, Number(roulette?.rouletteSpinDurationMs || roulette?.spinDurationMs) || DEFAULT_ROULETTE_CONFIG.spinDurationMs);

  if (!roulette?.rouletteRunning || !Number.isFinite(end) || !Number.isFinite(startedAt)) {
    return Number.isFinite(end) ? end : start;
  }

  const launchDuration = Number(roulette?.rouletteSpinLaunchDurationMs);
  const sustainDuration = Number(roulette?.rouletteSpinSustainDurationMs);
  const releaseDuration = Number(roulette?.rouletteSpinReleaseDurationMs);
  const targetVelocity = Number(roulette?.rouletteSpinVelocityTurnsPerSecond);
  const initialVelocity = Number(roulette?.rouletteSpinInitialVelocityTurnsPerSecond);
  const launchEnd = Number(roulette?.rouletteLaunchEndRotation);
  const bodyEnd = Number(roulette?.rouletteBodyEndRotation);

  // Nuevo modelo (patch 147): impulso fijo -> sustain -> release.
  if (
    Number.isFinite(launchDuration) &&
    Number.isFinite(sustainDuration) &&
    Number.isFinite(releaseDuration) &&
    Number.isFinite(targetVelocity) &&
    Number.isFinite(initialVelocity) &&
    Number.isFinite(launchEnd) &&
    Number.isFinite(bodyEnd)
  ) {
    const elapsed = Math.max(0, nowMs - startedAt);

    const direction = Number(roulette?.rouletteSpinDirection) === -1 ? -1 : 1;

    if (elapsed <= launchDuration) {
      const progress = elapsed / Math.max(1, launchDuration);
      const turns = launchDistanceTurns(progress, launchDuration / 1000, initialVelocity, targetVelocity);
      return start + (direction * turns * 360);
    }

    const sustainElapsed = elapsed - launchDuration;
    if (sustainElapsed <= sustainDuration) {
      return launchEnd + (direction * targetVelocity * (sustainElapsed / 1000) * 360);
    }

    const releaseElapsed = sustainElapsed - sustainDuration;
    const releaseProgress = Math.max(0, Math.min(1, releaseElapsed / Math.max(1, releaseDuration)));
    const turns = releaseDistanceTurns(releaseProgress, releaseDuration / 1000, targetVelocity);
    return bodyEnd + (direction * turns * 360);
  }

  // Compatibilidad con giros iniciados antes del patch 147.
  const legacyBodyEnd = Number(roulette?.rouletteBodyEndRotation);
  if (!Number.isFinite(legacyBodyEnd) || !Number.isFinite(Number(roulette?.rouletteSpinBodyDurationMs)) || !Number.isFinite(Number(roulette?.rouletteSpinReleaseDurationMs))) {
    const progress = Math.max(0, Math.min(1, (nowMs - startedAt) / totalDuration));
    const t = 1 - Math.pow(1 - progress, 2.2);
    return start + ((end - start) * t);
  }

  const bodyDuration = Math.max(1, Number(roulette.rouletteSpinBodyDurationMs));
  const legacyReleaseDuration = Math.max(1, Number(roulette.rouletteSpinReleaseDurationMs));
  const elapsed = Math.max(0, nowMs - startedAt);

  if (elapsed <= bodyDuration) {
    const progress = Math.max(0, Math.min(1, elapsed / bodyDuration));
    return start + ((legacyBodyEnd - start) * progress);
  }

  const releaseProgress = Math.max(0, Math.min(1, (elapsed - bodyDuration) / legacyReleaseDuration));
  const coast = 1 - Math.pow(1 - releaseProgress, 1.45);
  return legacyBodyEnd + ((end - legacyBodyEnd) * coast);
}

export function rouletteWinnerAtRotation(roulette, rotation = roulette?.rouletteEndRotation) {
  const startedAt = Number(roulette?.rouletteStartedAtMs);
  if (!Number.isFinite(startedAt)) return null;
  const entries = rouletteEntries(roulette?.entriesText);
  if (!entries.length) return null;
  const endRotation = Number(rotation);
  if (!Number.isFinite(endRotation)) return null;
  const segment = 360 / entries.length;
  const pointerPosition = modulo(-endRotation, 360);
  const index = Math.min(entries.length - 1, Math.floor(pointerPosition / segment));
  return { index, text: entries[index] };
}

export function spinRoulette(roulette, nowMs = Date.now(), random = Math.random) {
  const config = normalizeRouletteConfig(roulette);
  const entries = rouletteEntries(config.entriesText);
  if (entries.length < 2) return roulette;

  const startRotation = getRouletteRotation(roulette, nowMs);
  const launchDurationMs = ROULETTE_LAUNCH_DURATION_MS;
  const release = normalizeDecay(config.spinDecay);

  const randomUnit = () => Math.max(0, Math.min(0.999999, Number(random()) || 0));
  const randomSign = () => (randomUnit() < 0.5 ? -1 : 1);

  // Patch 153: cada tirada se separa ligeramente de los valores visibles del
  // usuario sin alterar sus preferencias. Las variaciones se calculan UNA sola
  // vez aquí y quedan serializadas en el objeto para que Editor y Overlay usen
  // exactamente la misma física durante todo el giro.
  const effectiveSpeed = clamp(config.spinSpeed + (randomSign() * 0.5), 0.5, 3.5, config.spinSpeed);
  const sustainDurationMs = Math.round(clamp(config.spinDurationMs + (randomSign() * 500), 2000, 30000, config.spinDurationMs));
  const baseReleaseScale = releaseMultiplier(release);
  const effectiveReleaseScale = Math.max(0.5, baseReleaseScale + (randomSign() * 0.5));
  const spinDirection = randomSign();

  // El tiempo configurado afecta SOLAMENTE el sustain. Impulso y release
  // conservan su propia física, así cambiar la duración no altera el frenado.
  const releaseDurationMs = Math.round(ROULETTE_RELEASE_BASE_MS * effectiveReleaseScale);
  const totalDurationMs = launchDurationMs + sustainDurationMs + releaseDurationMs;

  const launchVariation = 0.92 + (randomUnit() * 0.16);
  const microVariation = (randomUnit() - 0.5) * 0.12;
  const targetVelocity = Math.max(0.35, ((0.42 + (effectiveSpeed * 0.46)) * launchVariation) + microVariation);
  const initialVelocity = targetVelocity * 0.24;

  const launchSeconds = launchDurationMs / 1000;
  const sustainSeconds = sustainDurationMs / 1000;
  const releaseSeconds = releaseDurationMs / 1000;

  const launchTurns = launchDistanceTurns(1, launchSeconds, initialVelocity, targetVelocity);
  const sustainTurns = targetVelocity * sustainSeconds;
  const releaseTurns = releaseDistanceTurns(1, releaseSeconds, targetVelocity);

  const launchEndRotation = startRotation + (spinDirection * launchTurns * 360);
  const bodyEndRotation = launchEndRotation + (spinDirection * sustainTurns * 360);
  const endRotation = bodyEndRotation + (spinDirection * releaseTurns * 360);

  return {
    ...roulette,
    ...config,
    rouletteRunning: true,
    rouletteStartedAtMs: nowMs,
    rouletteSpinDurationMs: totalDurationMs,
    rouletteSpinLaunchDurationMs: launchDurationMs,
    rouletteSpinSustainDurationMs: sustainDurationMs,
    rouletteSpinReleaseDurationMs: releaseDurationMs,
    rouletteSpinVelocityTurnsPerSecond: targetVelocity,
    rouletteSpinInitialVelocityTurnsPerSecond: initialVelocity,
    rouletteSpinDirection: spinDirection,
    rouletteSpinEffectiveSpeed: effectiveSpeed,
    rouletteSpinEffectiveReleaseScale: effectiveReleaseScale,
    rouletteSpinDecay: release,
    rouletteStartRotation: startRotation,
    rouletteLaunchEndRotation: launchEndRotation,
    rouletteBodyEndRotation: bodyEndRotation,
    rouletteEndRotation: endRotation,
    rouletteWinnerIndex: null,
    rouletteWinnerText: '',
    rouletteSpinSerial: Number(roulette.rouletteSpinSerial || 0) + 1
  };
}

export function cancelRouletteSpin(roulette, nowMs = Date.now()) {
  if (!roulette || roulette.tipo !== 'roulette') return roulette;
  const currentRotation = getRouletteRotation(roulette, nowMs);
  return {
    ...roulette,
    rouletteRunning: false,
    rouletteStartedAtMs: null,
    rouletteSpinDurationMs: null,
    rouletteSpinLaunchDurationMs: null,
    rouletteSpinSustainDurationMs: null,
    rouletteSpinReleaseDurationMs: null,
    rouletteSpinVelocityTurnsPerSecond: null,
    rouletteSpinInitialVelocityTurnsPerSecond: null,
    rouletteStartRotation: currentRotation,
    rouletteLaunchEndRotation: currentRotation,
    rouletteBodyEndRotation: currentRotation,
    rouletteEndRotation: currentRotation,
    rouletteWinnerIndex: null,
    rouletteWinnerText: '',
    rouletteCancelledAtMs: nowMs
  };
}

export function shuffleRouletteEntries(roulette, random = Math.random) {
  const entries = rouletteEntries(roulette?.entriesText);
  const shuffled = [...entries];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(Math.max(0, Math.min(0.999999, Number(random()) || 0)) * (index + 1));
    [shuffled[index], shuffled[swap]] = [shuffled[swap], shuffled[index]];
  }
  return {
    ...roulette,
    entriesText: shuffled.join('\n'),
    rouletteRunning: false,
    rouletteWinnerIndex: null,
    rouletteWinnerText: '',
    rouletteStartedAtMs: null,
    rouletteSpinDurationMs: null,
    rouletteStartRotation: Number(roulette?.rouletteEndRotation) || Number(roulette?.rouletteStartRotation) || 0
  };
}

export function rouletteColors(roulette) {
  const config = normalizeRouletteConfig(roulette);
  return config.baseColor ? roulettePaletteFromColor(config.baseColor) : paletteColors(config.palette);
}

export function removeRouletteWinner(roulette) {
  const entries = rouletteEntries(roulette?.entriesText);
  const winner = rouletteWinnerAtRotation(roulette);
  if (!winner || winner.index < 0 || winner.index >= entries.length) return roulette;
  const nextEntries = entries.filter((_, index) => index !== winner.index);
  return {
    ...roulette,
    entriesText: nextEntries.join('\n'),
    rouletteRunning: false,
    rouletteWinnerIndex: null,
    rouletteWinnerText: '',
    rouletteStartedAtMs: null,
    rouletteSpinDurationMs: null,
    rouletteStartRotation: Number(roulette?.rouletteEndRotation) || Number(roulette?.rouletteStartRotation) || 0
  };
}
