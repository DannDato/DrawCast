import fs from 'node:fs/promises';
import path from 'node:path';
import logger from '../helpers/winston.js';
import { models } from '../models/index.js';

const runtimes = new Map();
const sleepMs = Math.max(60_000, Number(process.env.CHANNEL_SLEEP_MINUTES || 10) * 60_000);
const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');

const EDITOR_COLOR_SLOTS = 12;

function makeRuntimeDrawLayer(objects = new Map()) {
  const maxZ = Math.max(0, ...Array.from(objects.values()).map((object) => Number(object?.zIndex) || 0));
  return {
    id: `draw_layer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    tipo: 'draw',
    compuesto: true,
    x: 0,
    y: 0,
    w: 1920,
    h: 1080,
    sourceWidth: 1920,
    sourceHeight: 1080,
    rotation: 0,
    lineas: [],
    hidden: false,
    layerName: 'DIBUJO 1',
    zIndex: maxZ + 1
  };
}

function hasDrawLayer(objects) {
  return Array.from(objects.values()).some((object) => object?.tipo === 'draw' || object?.tipo === 'trazo');
}

function ensureDrawLayer(objects) {
  if (hasDrawLayer(objects)) return null;
  const layer = makeRuntimeDrawLayer(objects);
  objects.set(layer.id, layer);
  return layer;
}

function runtime(channelId) {
  if (!runtimes.has(channelId)) {
    const initialLayer = makeRuntimeDrawLayer();
    runtimes.set(channelId, {
      objects: new Map([[initialLayer.id, initialLayer]]),
      publishedObjects: new Map([[initialLayer.id, initialLayer]]),
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

function editorColorSlot(r) {
  const used = new Set(Array.from(r.editors.values()).map((editor) => editor.colorSlot));
  const available = Array.from({ length: EDITOR_COLOR_SLOTS }, (_, index) => index + 1).filter((slot) => !used.has(slot));
  const pool = available.length ? available : Array.from({ length: EDITOR_COLOR_SLOTS }, (_, index) => index + 1);
  return pool[Math.floor(Math.random() * pool.length)];
}

function editorCanEdit(r, socketId) {
  if (r.liveEnabled) return true;
  return Boolean(r.studioEditorSocketId && r.studioEditorSocketId === socketId);
}


export function destroyChannelRuntime(channelId) {
  const r = runtimes.get(channelId);
  if (!r) return;
  if (r.sleepTimer) clearTimeout(r.sleepTimer);
  runtimes.delete(channelId);
}

export function getChannelState(channelId) {
  return mapToList(runtime(channelId).objects);
}

export function getPublishedChannelState(channelId) {
  return mapToList(runtime(channelId).publishedObjects);
}

function controlFromRuntime(r) {
  return {
    liveEnabled: r.liveEnabled,
    overlayHidden: r.overlayHidden,
    hasDraftChanges: r.hasDraftChanges,
    editorCount: r.editors.size,
    liveRequired: r.editors.size > 1
  };
}

function presenceFromRuntime(r) {
  const editorList = Array.from(r.editors.entries()).map(([socketId, editor]) => ({
    socketId,
    userUuid: editor.userUuid,
    username: editor.username,
    displayName: editor.displayName,
    avatarUrl: editor.avatarUrl || null,
    colorSlot: editor.colorSlot,
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

export function getChannelRuntimeSnapshot(channelId) {
  const r = runtimes.get(channelId);
  if (!r) {
    return {
      control: { liveEnabled: true, overlayHidden: false, hasDraftChanges: false, editorCount: 0, liveRequired: false },
      presence: { editors: 0, overlays: 0, clients: 0, editorList: [] }
    };
  }
  return { control: controlFromRuntime(r), presence: presenceFromRuntime(r) };
}

export function getChannelControl(channelId) {
  return controlFromRuntime(runtime(channelId));
}

export function getChannelPresence(channelId) {
  return presenceFromRuntime(runtime(channelId));
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
  const fallback = ensureDrawLayer(r.objects);
  if (r.liveEnabled) {
    r.publishedObjects.delete(id);
    if (fallback) r.publishedObjects.set(fallback.id, fallback);
    r.hasDraftChanges = false;
  } else {
    r.hasDraftChanges = true;
  }
  return { control: getChannelControl(channelId), fallback };
}

export function clearObjects(channelId) {
  const r = runtime(channelId);
  r.objects.clear();
  const fallback = ensureDrawLayer(r.objects);
  if (r.liveEnabled) {
    r.publishedObjects.clear();
    if (fallback) r.publishedObjects.set(fallback.id, fallback);
    r.hasDraftChanges = false;
  } else {
    r.hasDraftChanges = true;
  }
  return { control: getChannelControl(channelId), fallback };
}

export function replaceObjects(channelId, objects = []) {
  const r = runtime(channelId);
  r.objects.clear();
  objects.forEach((object) => r.objects.set(object.id, object));
  ensureDrawLayer(r.objects);
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
      userUuid: metadata.userUuid ?? null,
      username: String(metadata.username || '').trim().replace(/^@/, '').slice(0, 80),
      displayName: String(metadata.displayName || metadata.username || 'Editor').slice(0, 120),
      avatarUrl: metadata.avatarUrl ? String(metadata.avatarUrl).slice(0, 500) : null,
      isOwner: Boolean(metadata.isOwner),
      colorSlot: editorColorSlot(r)
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
