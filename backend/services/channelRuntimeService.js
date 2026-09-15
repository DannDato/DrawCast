import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../helpers/winston.js';

const runtimes = new Map();
const sleepMs = Math.max(60_000, Number(process.env.CHANNEL_SLEEP_MINUTES || 10) * 60_000);
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');

function runtime(channelId) {
  if (!runtimes.has(channelId)) runtimes.set(channelId, { objects: new Map(), editors: new Set(), overlays: new Set(), sleepTimer: null });
  return runtimes.get(channelId);
}

export function getChannelState(channelId) { return Array.from(runtime(channelId).objects.values()); }
export function setObject(channelId, object) { runtime(channelId).objects.set(object.id, object); }
export function removeObject(channelId, id) { runtime(channelId).objects.delete(id); }
export function clearObjects(channelId) { runtime(channelId).objects.clear(); }
export function presence(channelId) { const r = runtime(channelId); return { editors: r.editors.size, overlays: r.overlays.size, clients: r.editors.size + r.overlays.size }; }

export function connectRole(channelId, socketId, role, io) {
  const r = runtime(channelId);
  if (role === 'editor') { r.editors.add(socketId); if (r.sleepTimer) { clearTimeout(r.sleepTimer); r.sleepTimer = null; } }
  if (role === 'overlay') r.overlays.add(socketId);
  io.to(`channel:${channelId}`).emit('presence', presence(channelId));
}

export function disconnectRole(channelId, socketId, io) {
  const r = runtime(channelId); r.editors.delete(socketId); r.overlays.delete(socketId);
  io.to(`channel:${channelId}`).emit('presence', presence(channelId));
  if (!r.editors.size && !r.sleepTimer) r.sleepTimer = setTimeout(async () => {
    if (r.editors.size) return;
    r.objects.clear();
    try { await fs.rm(path.join(uploadRoot, String(channelId)), { recursive: true, force: true }); } catch (error) { logger.warn('No fue posible limpiar uploads del canal', { channelId, error: error.message }); }
    io.to(`channel:${channelId}`).emit('clear-all');
    logger.info('Canal dormido y datos temporales eliminados', { channelId });
    r.sleepTimer = null;
  }, sleepMs);
}
