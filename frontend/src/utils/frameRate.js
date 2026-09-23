export const GRAPHICS_FPS = 30;
export const GRAPHICS_FRAME_MS = 1000 / GRAPHICS_FPS;

export function createFrameLimiter(frameMs = GRAPHICS_FRAME_MS) {
  let nextFrameAt = 0;

  return (timestamp) => {
    if (!Number.isFinite(timestamp)) return false;
    if (!nextFrameAt) {
      nextFrameAt = timestamp + frameMs;
      return true;
    }
    if (timestamp + 0.25 < nextFrameAt) return false;

    const lateBy = Math.max(0, timestamp - nextFrameAt);
    nextFrameAt += (Math.floor(lateBy / frameMs) + 1) * frameMs;
    return true;
  };
}
