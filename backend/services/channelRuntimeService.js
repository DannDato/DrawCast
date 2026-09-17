import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../helpers/winston.js';
import { models } from '../models/index.js';

const runtimes = new Map();
const sleepMs = Math.max(60_000, Number(process.env.CHANNEL_SLEEP_MINUTES || 10) * 60_000);
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');

const EDITOR_COLORS = [
  '#ff5c8a', '#4cc9f0', '#ffd166', '#7bd88f', '#b794f4', '#ff9f68',
  '#5eead4', '#f472b6', '#60a5fa', '#a3e635', '#f59e0b', '#c084fc'
];

function runtime(channelId) {
  if (!runtimes.has(channelId)) {
    runtimes.set(channelId, {
      objects: new Map(),
      publishedObjects: new Map(),
      editors: new Map(),
      overlays: new Set(),
      liveEnabled: true,
      overlayHidden: false,
      hasDraftChanges: false,
      studioEditorSocketId: null,
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

function editorColor(r) {
  const used = new Set(Array.from(r.editors.values()).map((editor) => editor.color));
  const available = EDITOR_COLORS.filter((color) => !used.has(color));
  const pool = available.length ? available : EDITOR_COLORS;
  return pool[Math.floor(Math.random() * pool.length)];
}

function editorCanEdit(r, socketId) {
  if (r.liveEnabled) return true;
  return Boolean(r.studioEditorSocketId && r.studioEditorSocketId === socketId);
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
    hasDraftChanges: r.hasDraftChanges,
    editorCount: r.editors.size,
    liveRequired: r.editors.size > 1
  };
}

export function getChannelPresence(channelId) {
  const r = runtime(channelId);
  const editorList = Array.from(r.editors.entries()).map(([socketId, editor]) => ({
    socketId,
    userId: editor.userId,
    username: editor.username,
    displayName: editor.displayName,
    avatarUrl: editor.avatarUrl || null,
    color: editor.color,
    isOwner: Boolean(editor.isOwner),
    canEdit: editorCanEdit(r, socketId)
  }));

  return {
    editors: r.editors.size,
    overlays: r.overlays.size,
    clients: r.editors.size + r.overlays.size,
    editorList
  };
}

export function getEditorAccess(channelId, socketId) {
  const r = runtime(channelId);
  const editor = r.editors.get(socketId);
  return {
    canEdit: Boolean(editor && editorCanEdit(r, socketId)),
    liveEnabled: r.liveEnabled,
    liveRequired: r.editors.size > 1,
    editorCount: r.editors.size,
    isStudioEditor: Boolean(editor && !r.liveEnabled && r.studioEditorSocketId === socketId)
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

export function setLiveEnabled(channelId, enabled, socketId = null) {
  const r = runtime(channelId);
  const next = Boolean(enabled);
  if (r.liveEnabled === next) return getChannelControl(channelId);

  r.liveEnabled = next;
  if (next) {
    r.publishedObjects = copyMap(r.objects);
    r.hasDraftChanges = false;
    r.studioEditorSocketId = null;
  } else {
    // Un único editor "posee" la sesión de Estudio. Si después entra alguien más,
    // ese nuevo editor queda como observador hasta que esta sesión vuelva a Live.
    r.publishedObjects = copyMap(r.objects);
    r.hasDraftChanges = false;
    r.studioEditorSocketId = socketId;
  }

  return getChannelControl(channelId);
}

export function setOverlayHidden(channelId, hidden) {
  const r = runtime(channelId);
  r.overlayHidden = Boolean(hidden);
  return getChannelControl(channelId);
}

export function connectRole(channelId, socketId, role, metadata = {}) {
  const r = runtime(channelId);
  if (role === 'editor') {
    const wasEmpty = r.editors.size === 0;
    r.editors.set(socketId, {
      userId: metadata.userId ?? null,
      username: String(metadata.username || '').trim().replace(/^@/, '').slice(0, 80),
      displayName: String(metadata.displayName || metadata.username || 'Editor').slice(0, 120),
      avatarUrl: metadata.avatarUrl ? String(metadata.avatarUrl).slice(0, 500) : null,
      isOwner: Boolean(metadata.isOwner),
      color: editorColor(r)
    });

    // Si el único editor de Estudio se reconecta antes de que el canal duerma,
    // la nueva sesión toma control de ese borrador en lugar de quedar bloqueada.
    if (wasEmpty && !r.liveEnabled) r.studioEditorSocketId = socketId;

    if (r.sleepTimer) {
      clearTimeout(r.sleepTimer);
      r.sleepTimer = null;
    }
  }
  if (role === 'overlay') r.overlays.add(socketId);
  return getChannelPresence(channelId);
}

export function disconnectRole(channelId, socketId, io) {
  const r = runtime(channelId);
  const wasStudioEditor = r.studioEditorSocketId === socketId;
  r.editors.delete(socketId);
  r.overlays.delete(socketId);

  let forcedLive = false;
  if (wasStudioEditor) {
    r.studioEditorSocketId = null;
    if (!r.liveEnabled && r.editors.size > 0) {
      // Evita dejar a colaboradores bloqueados para siempre si quien tenía el borrador
      // se desconecta. Conservamos su trabajo, lo publicamos y devolvemos el canal a Live.
      r.liveEnabled = true;
      r.publishedObjects = copyMap(r.objects);
      r.hasDraftChanges = false;
      forcedLive = true;
    }
  }

  if (!r.editors.size && !r.sleepTimer) {
    r.sleepTimer = setTimeout(async () => {
      if (r.editors.size) return;

      r.objects.clear();
      r.publishedObjects.clear();
      r.liveEnabled = true;
      r.overlayHidden = false;
      r.hasDraftChanges = false;
      r.studioEditorSocketId = null;

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

  return {
    forcedLive,
    presence: getChannelPresence(channelId),
    control: getChannelControl(channelId),
    publishedObjects: forcedLive ? getPublishedChannelState(channelId) : null
  };
}
