import { useEffect, useRef } from 'react';
import { getRouletteRotation, rouletteEntries } from './rouletteTool';

const ROULETTE_TICK_URL = '/sounds/roulette-tick.wav';
const MIN_TICK_INTERVAL_MS = 20;
const TICK_VOLUME = 0.72;

function boundaryIndex(roulette, nowMs) {
  const count = rouletteEntries(roulette?.entriesText).length;
  if (count < 2) return null;
  const rotation = getRouletteRotation(roulette, nowMs);
  if (!Number.isFinite(rotation)) return null;
  const segment = 360 / count;
  // Misma referencia angular que usa rouletteWinnerAtRotation(): el puntero
  // permanece fijo mientras la rueda gira por debajo.
  return Math.floor((-rotation) / segment);
}

function createAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  try {
    return new AudioContextClass({ latencyHint: 'interactive' });
  } catch {
    try {
      return new AudioContextClass();
    } catch {
      return null;
    }
  }
}

async function loadTickBuffer(audioContext) {
  if (!audioContext || typeof fetch !== 'function') return null;
  try {
    const response = await fetch(ROULETTE_TICK_URL, { cache: 'force-cache' });
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    return await audioContext.decodeAudioData(data);
  } catch {
    return null;
  }
}

export default function useRouletteTickSound(objects, { enabled = true } = {}) {
  const objectsRef = useRef(objects);
  const enabledRef = useRef(enabled);
  const stateRef = useRef(new Map());
  const audioContextRef = useRef(null);
  const tickBufferRef = useRef(null);
  const gainRef = useRef(null);
  const sourceRef = useRef(null);
  const lastTickAtRef = useRef(0);

  useEffect(() => { objectsRef.current = objects; }, [objects]);
  useEffect(() => { enabledRef.current = enabled; }, [enabled]);

  useEffect(() => {
    const audioContext = createAudioContext();
    audioContextRef.current = audioContext;

    if (audioContext) {
      const gain = audioContext.createGain();
      gain.gain.value = TICK_VOLUME;
      gain.connect(audioContext.destination);
      gainRef.current = gain;

      loadTickBuffer(audioContext).then((buffer) => {
        if (audioContextRef.current === audioContext) tickBufferRef.current = buffer;
      });
    }

    const unlockAudio = () => {
      const context = audioContextRef.current;
      if (context?.state === 'suspended') context.resume().catch(() => {});
    };

    // Desbloquea Web Audio en navegadores que exigen una interacción. En OBS
    // normalmente el contexto puede reproducir sin este paso.
    window.addEventListener('pointerdown', unlockAudio, { passive: true });
    window.addEventListener('keydown', unlockAudio);

    let frameId = null;
    let active = true;

    const playTick = (nowMs) => {
      if (nowMs - lastTickAtRef.current < MIN_TICK_INTERVAL_MS) return;

      const context = audioContextRef.current;
      const buffer = tickBufferRef.current;
      const gain = gainRef.current;
      if (!context || !buffer || !gain) return;

      lastTickAtRef.current = nowMs;

      try {
        if (context.state === 'suspended') context.resume().catch(() => {});

        // Una sola voz: el buffer ya está decodificado en memoria, así que no
        // hay seek/currentTime ni arranque de <audio> en cada fragmento.
        if (sourceRef.current) {
          try { sourceRef.current.stop(); } catch { /* ya terminó */ }
          sourceRef.current.disconnect();
        }

        const source = context.createBufferSource();
        source.buffer = buffer;
        source.connect(gain);
        source.onended = () => {
          if (sourceRef.current === source) sourceRef.current = null;
          try { source.disconnect(); } catch { /* ya desconectado */ }
        };
        sourceRef.current = source;
        source.start(0);
      } catch {
        // Si el navegador bloquea Web Audio, se reintentará en el siguiente
        // cruce después de que exista una interacción permitida.
      }
    };

    const frame = () => {
      if (!active) return;
      const now = Date.now();
      const source = objectsRef.current;
      const list = Array.isArray(source) ? source : Object.values(source || {});
      const liveIds = new Set();

      for (const roulette of list) {
        if (!roulette || roulette.tipo !== 'roulette' || roulette.hidden) continue;
        const id = roulette.id || roulette.uuid;
        if (!id) continue;
        liveIds.add(id);

        const serial = Number(roulette.rouletteSpinSerial || 0);
        const startedAt = Number(roulette.rouletteStartedAtMs);
        const duration = Number(roulette.rouletteSpinDurationMs || roulette.spinDurationMs);
        const physicalEndAt = startedAt + duration;
        const running = (
          enabledRef.current &&
          !roulette.rouletteMuted &&
          roulette.rouletteRunning &&
          Number.isFinite(startedAt) &&
          Number.isFinite(duration) &&
          now <= physicalEndAt
        );
        const boundary = running ? boundaryIndex(roulette, now) : null;
        const previous = stateRef.current.get(id);

        // El renderer conserva una pequeña ventana extra tras el final físico
        // del giro para cerrar la animación/resultados. El audio NO usa esa
        // tolerancia: al llegar al instante físico exacto del final dejamos de
        // detectar cruces. Así no aparece un tic residual cuando la rueda ya se
        // percibe detenida.
        if (!running || boundary == null) {
          stateRef.current.delete(id);
          continue;
        }

        // Una tirada nueva se inicializa silenciosamente en el fragmento actual.
        // El primer clic ocurre al cruzar realmente la siguiente división.
        if (!previous || previous.serial !== serial) {
          stateRef.current.set(id, { serial, boundary });
          continue;
        }

        if (previous.boundary !== boundary) {
          playTick(now);
          stateRef.current.set(id, { serial, boundary });
        }
      }

      for (const id of stateRef.current.keys()) {
        if (!liveIds.has(id)) stateRef.current.delete(id);
      }

      frameId = requestAnimationFrame(frame);
    };

    frameId = requestAnimationFrame(frame);
    return () => {
      active = false;
      if (frameId != null) cancelAnimationFrame(frameId);
      window.removeEventListener('pointerdown', unlockAudio);
      window.removeEventListener('keydown', unlockAudio);

      if (sourceRef.current) {
        try { sourceRef.current.stop(); } catch { /* ya terminó */ }
        try { sourceRef.current.disconnect(); } catch { /* ya desconectado */ }
      }
      sourceRef.current = null;

      if (gainRef.current) {
        try { gainRef.current.disconnect(); } catch { /* ya desconectado */ }
      }
      gainRef.current = null;
      tickBufferRef.current = null;
      stateRef.current.clear();

      if (audioContextRef.current === audioContext && audioContext) {
        audioContext.close().catch(() => {});
      }
      audioContextRef.current = null;
    };
  }, []);
}
