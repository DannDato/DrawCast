import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../helpers/winston.js';
import { models } from '../models/index.js';

const runtimes = new Map();
const sleepMs = Math.max(60_000, Number(process.env.CHANNEL_SLEEP_MINUTES || 10) * 60_000);
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');

function runtime(channelId) {
  if (!runtimes.has(channelId)) {
    runtimes.set(channelId, {
      objects: new Map(),
      publishedObjects: new Map(),
      editors: new Set(),
      overlays: new Set(),
      liveEnabled: true,
      overlayHidden: false,
      hasDraftChanges: false,
      sleepTimer: null
    });
  }
  return runtimes.get(channelId);
}

function mapToList(map) {
  return Array.from(map.values());
}

function copyMap(source) {
  return new Map(source.entries());
}

export function getChannelState(channelId) {
  return mapToList(runtime(channelId).objects);
}

export function getPublishedChannelState(channelId) {
  return mapToList(runtime(channelId).publishedObjects);
}

export function getChannelControl(channelId) {
  const r = runtime(channelId);
  return {
    liveEnabled: r.liveEnabled,
    overlayHidden: r.overlayHidden,
    hasDraftChanges: r.hasDraftChanges
  };
}

export function setObject(channelId, object) {
  const r = runtime(channelId);
  r.objects.set(object.id, object);
  if (r.liveEnabled) {
    r.publishedObjects.set(object.id, object);
    r.hasDraftChanges = false;
  } else {
    r.hasDraftChanges = true;
  }
  return getChannelControl(channelId);
}

export function removeObject(channelId, id) {
  const r = runtime(channelId);
  r.objects.delete(id);
  if (r.liveEnabled) {
    r.publishedObjects.delete(id);
    r.hasDraftChanges = false;
  } else {
    r.hasDraftChanges = true;
  }
  return getChannelControl(channelId);
}

export function clearObjects(channelId) {
  const r = runtime(channelId);
  r.objects.clear();
  if (r.liveEnabled) {
    r.publishedObjects.clear();
    r.hasDraftChanges = false;
  } else {
    r.hasDraftChanges = true;
  }
  return getChannelControl(channelId);
}

export function replaceObjects(channelId, objects = []) {
  const r = runtime(channelId);
  r.objects.clear();
  objects.forEach((object) => r.objects.set(object.id, object));
  if (r.liveEnabled) {
    r.publishedObjects = copyMap(r.objects);
    r.hasDraftChanges = false;
  } else {
    r.hasDraftChanges = true;
  }
  return getChannelState(channelId);
}

export function publishChannelState(channelId) {
  const r = runtime(channelId);
  r.publishedObjects = copyMap(r.objects);
  r.hasDraftChanges = false;
  return getPublishedChannelState(channelId);
}

export function setLiveEnabled(channelId, enabled) {
  const r = runtime(channelId);
  const next = Boolean(enabled);
  if (r.liveEnabled === next) return getChannelControl(channelId);

  r.liveEnabled = next;
  if (next) {
    r.publishedObjects = copyMap(r.objects);
    r.hasDraftChanges = false;
  } else {
    // Al entrar a modo estudio, el overlay conserva exactamente el último estado visible.
    r.publishedObjects = copyMap(r.objects);
    r.hasDraftChanges = false;
  }

  return getChannelControl(channelId);
}

export function setOverlayHidden(channelId, hidden) {
  const r = runtime(channelId);
  r.overlayHidden = Boolean(hidden);
  return getChannelControl(channelId);
}

export function presence(channelId) {
  const r = runtime(channelId);
  return {
    editors: r.editors.size,
    overlays: r.overlays.size,
    clients: r.editors.size + r.overlays.size
  };
}

export function connectRole(channelId, socketId, role, io) {
  const r = runtime(channelId);
  if (role === 'editor') {
    r.editors.add(socketId);
    if (r.sleepTimer) {
      clearTimeout(r.sleepTimer);
      r.sleepTimer = null;
    }
  }
  if (role === 'overlay') r.overlays.add(socketId);
  io.to(`channel:${channelId}`).emit('presence', presence(channelId));
}

export function disconnectRole(channelId, socketId, io) {
  const r = runtime(channelId);
  r.editors.delete(socketId);
  r.overlays.delete(socketId);
  io.to(`channel:${channelId}`).emit('presence', presence(channelId));

  if (!r.editors.size && !r.sleepTimer) {
    r.sleepTimer = setTimeout(async () => {
      if (r.editors.size) return;

      r.objects.clear();
      r.publishedObjects.clear();
      r.liveEnabled = true;
      r.overlayHidden = false;
      r.hasDraftChanges = false;

      const savedDesigns = await models.SavedDesign.count({ where: { channelId } });
      if (!savedDesigns) {
        try {
          await fs.rm(path.join(uploadRoot, String(channelId)), { recursive: true, force: true });
        } catch (error) {
          logger.warn('No fue posible limpiar uploads del canal', { channelId, error: error.message });
        }
      }

      io.to(`channel:${channelId}`).emit('clear-all');
      io.to(`channel:${channelId}:overlays`).emit('overlay-visibility', { hidden: false });
      logger.info(savedDesigns ? 'Canal dormido; medios conservados por diseños guardados' : 'Canal dormido y datos temporales eliminados', { channelId, savedDesigns });
      r.sleepTimer = null;
    }, sleepMs);
  }
}
