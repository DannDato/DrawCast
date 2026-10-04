const gifCache = new Map();
const GIF_CACHE_LIMIT = 12;
const MIN_FRAME_MS = 20;
const DEFAULT_FRAME_MS = 100;

function nowMs() {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function disposeEntry(entry) {
  for (const frame of entry?.frames || []) {
    try { frame.bitmap?.close?.(); } catch { /* noop */ }
  }
}

function trimCache() {
  if (gifCache.size <= GIF_CACHE_LIMIT) return;
  const candidates = [...gifCache.entries()]
    .filter(([, entry]) => entry.status !== 'loading')
    .sort((a, b) => (a[1].lastUsed || 0) - (b[1].lastUsed || 0));
  while (gifCache.size > GIF_CACHE_LIMIT && candidates.length) {
    const [url, entry] = candidates.shift();
    gifCache.delete(url);
    disposeEntry(entry);
  }
}

async function decodeGif(url, entry) {
  if (typeof ImageDecoder !== 'function' || typeof createImageBitmap !== 'function') {
    entry.status = 'unsupported';
    return;
  }

  try {
    if (typeof ImageDecoder.isTypeSupported === 'function') {
      const supported = await ImageDecoder.isTypeSupported('image/gif');
      if (!supported) {
        entry.status = 'unsupported';
        return;
      }
    }

    const response = await fetch(url, { mode: 'cors', cache: 'force-cache' });
    if (!response.ok) throw new Error(`GIF HTTP ${response.status}`);
    const data = await response.arrayBuffer();
    if (!data.byteLength) throw new Error('GIF vacío');

    const decoder = new ImageDecoder({ data, type: 'image/gif', preferAnimation: true });
    await decoder.tracks.ready;
    const track = decoder.tracks.selectedTrack;
    const frameCount = Math.max(1, Number(track?.frameCount) || 1);
    const frames = [];
    let totalDuration = 0;

    for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
      const result = await decoder.decode({ frameIndex, completeFramesOnly: true });
      const videoFrame = result.image;
      const bitmap = await createImageBitmap(videoFrame);
      const rawDurationMs = Number(videoFrame.duration) / 1000;
      const durationMs = Number.isFinite(rawDurationMs) && rawDurationMs > 0
        ? Math.max(MIN_FRAME_MS, rawDurationMs)
        : DEFAULT_FRAME_MS;
      frames.push({ bitmap, startsAt: totalDuration, durationMs });
      totalDuration += durationMs;
      videoFrame.close?.();
    }

    decoder.close?.();
    if (!frames.length || totalDuration <= 0) throw new Error('GIF sin frames decodificables');

    if (entry.cancelled) {
      frames.forEach((frame) => frame.bitmap?.close?.());
      return;
    }

    entry.frames = frames;
    entry.totalDuration = totalDuration;
    entry.startedAt = nowMs();
    entry.status = 'ready';
    entry.error = null;
    trimCache();
  } catch (error) {
    entry.status = 'error';
    entry.error = error;
  }
}

function entryFor(url) {
  if (!url) return null;
  let entry = gifCache.get(url);
  if (entry) {
    entry.lastUsed = nowMs();
    return entry;
  }

  entry = {
    status: 'loading',
    frames: [],
    totalDuration: 0,
    startedAt: nowMs(),
    lastUsed: nowMs(),
    error: null,
    cancelled: false
  };
  gifCache.set(url, entry);
  decodeGif(url, entry);
  trimCache();
  return entry;
}

export function warmAnimatedGif(url) {
  return entryFor(url);
}

export function getAnimatedGifFrame(url, timestampMs) {
  const entry = entryFor(url);
  if (!entry || entry.status !== 'ready' || !entry.frames.length || entry.totalDuration <= 0) return null;

  entry.lastUsed = nowMs();
  const clock = Number.isFinite(Number(timestampMs)) ? Number(timestampMs) : Date.now();
  // Date.now() is used by the editor/overlay render loop. Keeping the animation
  // modulo the GIF duration makes it deterministic in both localhost and prod.
  const elapsed = ((clock % entry.totalDuration) + entry.totalDuration) % entry.totalDuration;

  let frame = entry.frames[entry.frames.length - 1];
  for (let index = 0; index < entry.frames.length; index += 1) {
    const candidate = entry.frames[index];
    if (elapsed >= candidate.startsAt && elapsed < candidate.startsAt + candidate.durationMs) {
      frame = candidate;
      break;
    }
  }
  return frame.bitmap;
}

export function animatedGifStatus(url) {
  return entryFor(url)?.status || 'idle';
}
