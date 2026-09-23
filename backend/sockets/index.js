import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { models } from '../models/index.js';
import { env } from '../config/env.js';
import { sha256 } from '../helpers/security.js';
import { getEditableChannel, getEditableChannelByPublicKey } from '../services/channelAccessService.js';
import {
  appendDrawStroke,
  clearObjects,
  connectRole,
  disconnectRole,
  getChannelControl,
  getChannelPresence,
  getChannelState,
  getEditorAccess,
  getPublishedChannelState,
  publishChannelState,
  patchObjects,
  removeObject,
  replaceObjects,
  setLiveEnabled,
  setObject,
  setOverlayHidden
} from '../services/channelRuntimeService.js';
import { getSound } from '../services/soundLibraryService.js';
import { getChannelSound } from '../services/channelSoundService.js';
import logger from '../helpers/winston.js';

const room = (channelId) => `channel:${channelId}`;
const editorRoom = (channelId) => `channel:${channelId}:editors`;
const overlayRoom = (channelId) => `channel:${channelId}:overlays`;
const EDITOR_CURSOR_LIMIT = 100000;
const SOUND_EVENT_MIN_INTERVAL_MS = 120;
const SOCKET_PREVIEW_MIN_INTERVAL_MS = 28;
const TRANSFORM_PATCH_KEYS = new Set(['x', 'y', 'w', 'h', 'rotation', 'fontSize']);
const TRANSFORM_LIMIT = 10000000;

function sanitizeTransformUpdates(payload) {
  const updates = Array.isArray(payload?.updates) ? payload.updates : null;
  if (!updates || !updates.length || updates.length > 100) return null;
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 50000) return null;

  const clean = [];
  for (const update of updates) {
    if (!update || typeof update.id !== 'string' || !update.id || update.id.length > 120 || !update.patch || typeof update.patch !== 'object') return null;
    const patch = {};
    for (const [key, value] of Object.entries(update.patch)) {
      if (!TRANSFORM_PATCH_KEYS.has(key)) return null;
      const numeric = Number(value);
      if (!Number.isFinite(numeric) || Math.abs(numeric) > TRANSFORM_LIMIT) return null;
      if ((key === 'w' || key === 'h') && numeric <= 0) return null;
      if (key === 'fontSize' && (numeric < 5 || numeric > 400)) return null;
      patch[key] = numeric;
    }
    if (!Object.keys(patch).length) return null;
    clean.push({ id: update.id, patch });
  }
  return clean;
}

function sanitizeDrawCommit(payload) {
  const layerId = typeof payload?.layerId === 'string' ? payload.layerId : '';
  const stroke = payload?.stroke;
  if (!layerId || layerId.length > 120 || !stroke || typeof stroke !== 'object') return null;
  if (typeof stroke.id !== 'string' || !stroke.id || stroke.id.length > 120) return null;
  if (!Array.isArray(stroke.points) || stroke.points.length < 2 || stroke.points.length > 50000) return null;
  if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 1000000) return null;

  const points = [];
  for (const point of stroke.points) {
    const x = Number(point?.x);
    const y = Number(point?.y);
    if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > TRANSFORM_LIMIT || Math.abs(y) > TRANSFORM_LIMIT) return null;
    points.push({ x, y });
  }

  const mode = stroke.mode === 'erase' || stroke.modo === 'borrar' ? 'erase' : 'paint';
  const size = Math.max(2, Math.min(100, Number(stroke.size ?? stroke.grosor) || 10));
  const opacity = mode === 'erase' ? 1 : Math.max(0.05, Math.min(1, Number(stroke.opacity) || 1));
  const brush = ['pencil', 'marker', 'highlighter'].includes(stroke.brush) ? stroke.brush : 'pencil';
  const color = /^#[0-9a-f]{6}$/i.test(String(stroke.color || '')) ? stroke.color : '#ffffff';

  return {
    layerId,
    stroke: {
      id: stroke.id,
      layerId,
      mode,
      modo: mode === 'erase' ? 'borrar' : 'pintar',
      color,
      size,
      grosor: size,
      brush,
      opacity,
      points
    }
  };
}

async function socketUser(socket) {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie || '');
    const token = cookies[env.cookieName];
    if (!token) return null;
    const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'fullstack-base' });
    const session = await models.Session.findOne({ where: { id: decoded.sid, userId: decoded.sub, tokenHash: sha256(token), revokedAt: null } });
    if (!session || session.expiresAt <= new Date()) return null;
    const user = await models.User.findByPk(decoded.sub);
    if (!user || user.statusKey !== 'ACTIVE') return null;
    return { user, session };
  } catch {
    return null;
  }
}

function validObject(object) {
  if (!object || typeof object !== 'object' || typeof object.id !== 'string' || object.id.length > 120) return false;
  const size = JSON.stringify(object).length;
  const isDraw = object.tipo === 'draw' || object.tipo === 'trazo';
  return size <= (isDraw ? 1800000 : 300000);
}

function validScene(list) {
  return Array.isArray(list)
    && list.length <= 500
    && list.every(validObject)
    && Buffer.byteLength(JSON.stringify(list), 'utf8') <= Number(process.env.SAVED_DESIGN_MAX_BYTES || 8388608);
}

function emitControl(io, channelId) {
  io.to(editorRoom(channelId)).emit('channel-control', getChannelControl(channelId));
}

function emitPresence(io, channelId) {
  const presence = getChannelPresence(channelId);
  io.to(editorRoom(channelId)).emit('presence', presence);
  presence.editorList.forEach((editor) => {
    io.to(editor.socketId).emit('editor-access', getEditorAccess(channelId, editor.socketId));
  });
}

function emitWorkspaceChange(io, socket, channelId, event, payload, controlBefore) {
  socket.to(editorRoom(channelId)).emit(event, payload);
  const control = getChannelControl(channelId);
  if (control.liveEnabled) io.to(overlayRoom(channelId)).emit(event, payload);
  if (controlBefore.hasDraftChanges !== control.hasDraftChanges) emitControl(io, channelId);
}

function canUseWorkspace(context, socket, reply) {
  const access = getEditorAccess(context.channelId, socket.id);
  if (access.canEdit) return true;
  socket.emit('editor-locked', access);
  reply?.({ ok: false, message: 'Hay un editor preparando cambios en modo Estudio. Espera a que publique y active Live.' });
  return false;
}


async function revalidateInteractiveAccess(joined) {
  if (!joined?.sessionId || !joined?.userId || !joined?.channelUuid) return false;
  if (Date.now() - joined.authorizedAt <= 1000) return true;
  if (joined.revalidatePromise) return joined.revalidatePromise;

  joined.revalidatePromise = Promise.all([
    models.Session.findOne({ where: { id: joined.sessionId, userId: joined.userId, revokedAt: null } }),
    getEditableChannel(joined.userId, joined.channelUuid)
  ]).then(([session, channel]) => {
    if (!session || session.expiresAt <= new Date() || !channel) return false;
    joined.authorizedAt = Date.now();
    return true;
  }).finally(() => {
    joined.revalidatePromise = null;
  });

  return joined.revalidatePromise;
}


export function configureSockets(io) {
  io.on('connection', (socket) => {
    let joined = null;

    socket.on('join-overlay', async ({ publicKey } = {}) => {
      const channel = await models.Channel.findOne({ where: { publicKey: String(publicKey || '') } });
      if (!channel) return socket.emit('access-denied');

      joined = { channelId: channel.id, role: 'overlay' };
      socket.join(room(channel.id));
      socket.join(overlayRoom(channel.id));
      connectRole(channel.id, socket.id, 'overlay');
      emitPresence(io, channel.id);
      socket.emit('overlay-visibility', { hidden: getChannelControl(channel.id).overlayHidden });
      socket.emit('sync-state', { objects: getPublishedChannelState(channel.id) });
    });



    socket.on('join-editor', async ({ publicKey } = {}) => {
      const auth = await socketUser(socket);
      if (!auth) return socket.emit('access-denied');
      const { user, session } = auth;

      const channel = await getEditableChannelByPublicKey(user.id, String(publicKey || ''));
      if (!channel) return socket.emit('access-denied');

      const beforePresence = getChannelPresence(channel.id);
      const beforeControl = getChannelControl(channel.id);
      const isOwner = Number(channel.ownerId) === Number(user.id);
      const username = user.username || `editor${user.id}`;
      const displayName = user.displayName || username || 'Editor';

      joined = { channelId: channel.id, channelUuid: channel.uuid, publicKey: channel.publicKey, role: 'editor', userId: user.id, sessionId: session.id, isOwner, authorizedAt: Date.now() };
      socket.data.channelId = channel.id;
      socket.data.userId = user.id;
      socket.data.role = 'editor';
      socket.join(room(channel.id));
      socket.join(editorRoom(channel.id));
      socket.join(`user:${user.id}`);
      socket.join(`session:${session.id}`);
      connectRole(channel.id, socket.id, 'editor', {
        userUuid: user.uuid,
        username,
        displayName,
        avatarUrl: user.avatarUrl || null,
        isOwner
      });

      socket.emit('sync-state', { objects: getChannelState(channel.id) });
      socket.emit('channel-control', getChannelControl(channel.id));
      emitPresence(io, channel.id);

      const access = getEditorAccess(channel.id, socket.id);
      if (!beforeControl.liveEnabled && beforePresence.editors > 0 && !access.canEdit) {
        socket.emit('studio-waiting', {
          message: 'Hay un editor preparando cambios en modo Estudio. Podrás editar cuando publique y vuelva a Live.'
        });
        const studioEditor = getChannelPresence(channel.id).editorList.find((editor) => editor.canEdit && editor.socketId !== socket.id);
        if (studioEditor) {
          io.to(studioEditor.socketId).emit('studio-collaborator-waiting', {
            editor: { username, displayName, avatarUrl: user.avatarUrl || null }
          });
        }
      }

      logger.info('Editor conectado al canal', { channelId: channel.id, userId: user.id, isOwner, editors: getChannelPresence(channel.id).editors });
    });

    const edit = (event, handler, options = {}) => socket.on(event, async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : null;
      if (!joined || joined.role !== 'editor') {
        socket.emit('access-denied');
        reply?.({ ok: false, message: 'Acceso denegado' });
        return;
      }

      if (options.minIntervalMs && (!options.throttleWhen || options.throttleWhen(payload))) {
        const rateKey = `rate:${options.rateKey || event}`;
        const now = Date.now();
        const previous = Number(socket.data[rateKey] || 0);
        if (now - previous < options.minIntervalMs) return;
        socket.data[rateKey] = now;
      }

      try {
        // Revalida sesión y permisos durante la conexión. La ventana corta evita
        // golpear la BD en cada movimiento de cursor; revocaciones normales además
        // desconectan el socket inmediatamente desde sus controladores HTTP.
        if (!(await revalidateInteractiveAccess(joined))) {
          socket.emit('access-revoked', { publicKey: joined.publicKey, reason: 'authorization-changed' });
          socket.disconnect(true);
          reply?.({ ok: false, message: 'Tu acceso ya no es válido' });
          return;
        }
      } catch (error) {
        logger.warn('No fue posible revalidar un socket de editor', { socketId: socket.id, userId: joined.userId, error: error.message });
        socket.disconnect(true);
        reply?.({ ok: false, message: 'No fue posible validar tu acceso' });
        return;
      }

      if (!options.allowWhenBlocked && !canUseWorkspace(joined, socket, reply)) return;
      try {
        await handler(joined, payload, reply);
      } catch (error) {
        logger.error('Falló una acción del editor por socket', { event, socketId: socket.id, userId: joined.userId, channelId: joined.channelId, error: error.message });
        reply?.({ ok: false, message: 'No fue posible procesar la acción.' });
      }
    });

    edit('obj-upsert', (context, object) => {
      if (!validObject(object)) return;
      const before = getChannelControl(context.channelId);
      setObject(context.channelId, object);
      emitWorkspaceChange(io, socket, context.channelId, 'obj-upsert', object, before);
    });

    edit('obj-transform', (context, payload) => {
      const updates = sanitizeTransformUpdates(payload);
      if (!updates) return;

      const before = getChannelControl(context.channelId);
      const result = patchObjects(context.channelId, updates);
      if (!result.updates.length) return;

      const event = { updates: result.updates };
      if (payload?.preview === true) {
        socket.to(editorRoom(context.channelId)).volatile.compress(false).emit('obj-transform', event);
        if (result.control.liveEnabled) io.to(overlayRoom(context.channelId)).volatile.compress(false).emit('obj-transform', event);
      } else {
        socket.to(editorRoom(context.channelId)).emit('obj-transform', event);
        if (result.control.liveEnabled) io.to(overlayRoom(context.channelId)).emit('obj-transform', event);
      }
      if (before.hasDraftChanges !== result.control.hasDraftChanges) emitControl(io, context.channelId);
    }, { minIntervalMs: SOCKET_PREVIEW_MIN_INTERVAL_MS, rateKey: 'transform-preview', throttleWhen: (payload) => payload?.preview === true });

    edit('obj-remove', (context, payload) => {
      if (!payload?.id) return;
      const before = getChannelControl(context.channelId);
      const { fallback } = removeObject(context.channelId, payload.id);
      emitWorkspaceChange(io, socket, context.channelId, 'obj-remove', { id: payload.id }, before);
      if (fallback) {
        io.to(editorRoom(context.channelId)).emit('obj-upsert', fallback);
        if (getChannelControl(context.channelId).liveEnabled) io.to(overlayRoom(context.channelId)).emit('obj-upsert', fallback);
      }
    });

    edit('clear-all', (context) => {
      const before = getChannelControl(context.channelId);
      const { fallback } = clearObjects(context.channelId);
      io.to(editorRoom(context.channelId)).emit('clear-all');
      if (fallback) io.to(editorRoom(context.channelId)).emit('obj-upsert', fallback);
      if (getChannelControl(context.channelId).liveEnabled) {
        io.to(overlayRoom(context.channelId)).emit('clear-all');
        if (fallback) io.to(overlayRoom(context.channelId)).emit('obj-upsert', fallback);
      }
      if (before.hasDraftChanges !== getChannelControl(context.channelId).hasDraftChanges) emitControl(io, context.channelId);
    });

    edit('scene-replace', (context, payload, reply) => {
      if (!validScene(payload?.objects)) {
        reply?.({ ok: false, message: 'La escena guardada no es válida' });
        return;
      }

      const before = getChannelControl(context.channelId);
      const objects = replaceObjects(context.channelId, payload.objects);
      io.to(editorRoom(context.channelId)).emit('sync-state', { objects });
      if (getChannelControl(context.channelId).liveEnabled) io.to(overlayRoom(context.channelId)).emit('sync-state', { objects: getPublishedChannelState(context.channelId) });
      if (before.hasDraftChanges !== getChannelControl(context.channelId).hasDraftChanges) emitControl(io, context.channelId);
      reply?.({ ok: true, count: objects.length });
    });

    edit('draw-live', (context, payload) => {
      if (JSON.stringify(payload || {}).length > 50000) return;
      const isPoint = payload?.phase === 'point';
      if (isPoint) socket.to(editorRoom(context.channelId)).volatile.compress(false).emit('draw-live', payload);
      else socket.to(editorRoom(context.channelId)).emit('draw-live', payload);

      if (getChannelControl(context.channelId).liveEnabled) {
        if (isPoint) io.to(overlayRoom(context.channelId)).volatile.compress(false).emit('draw-live', payload);
        else io.to(overlayRoom(context.channelId)).emit('draw-live', payload);
      }
    }, { minIntervalMs: SOCKET_PREVIEW_MIN_INTERVAL_MS, rateKey: 'draw-point', throttleWhen: (payload) => payload?.phase === 'point' });

    edit('draw-commit', (context, payload, reply) => {
      const clean = sanitizeDrawCommit(payload);
      if (!clean) {
        reply?.({ ok: false, message: 'El trazo no es válido.' });
        return;
      }

      const before = getChannelControl(context.channelId);
      const result = appendDrawStroke(context.channelId, clean.layerId, clean.stroke);
      if (!result.applied) {
        reply?.({ ok: false, code: result.reason, message: result.reason === 'layer-too-large' ? 'La capa de dibujo alcanzó su límite. Crea una capa nueva para seguir dibujando.' : 'La capa de dibujo ya no está disponible.' });
        return;
      }

      if (!result.duplicate) {
        const event = { layerId: clean.layerId, stroke: clean.stroke };
        socket.to(editorRoom(context.channelId)).emit('draw-commit', event);
        if (result.control.liveEnabled) io.to(overlayRoom(context.channelId)).emit('draw-commit', event);
      }
      if (before.hasDraftChanges !== result.control.hasDraftChanges) emitControl(io, context.channelId);
      reply?.({ ok: true, control: result.control });
    });

    socket.on('sound-play', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : null;
      if (!joined || joined.role !== 'editor') {
        socket.emit('access-denied');
        reply?.({ ok: false, message: 'Acceso denegado' });
        return;
      }

      try {
        if (!(await revalidateInteractiveAccess(joined))) {
          socket.emit('access-revoked', { publicKey: joined.publicKey, reason: 'authorization-changed' });
          socket.disconnect(true);
          reply?.({ ok: false, message: 'Tu acceso ya no es válido' });
          return;
        }

        const now = Date.now();
        const previous = Number(socket.data.lastSoundAt || 0);
        if (now - previous < SOUND_EVENT_MIN_INTERVAL_MS) {
          reply?.({ ok: false, message: 'Espera un instante antes de disparar otro sonido.' });
          return;
        }
        socket.data.lastSoundAt = now;

        if (getChannelControl(joined.channelId).overlayHidden) {
          reply?.({ ok: false, message: 'El overlay está apagado. Enciéndelo antes de reproducir sonidos.' });
          return;
        }

        let sound = await getSound(payload?.soundId);
        if (!sound) sound = await getChannelSound(joined.channelId, payload?.soundId);
        if (!sound) {
          reply?.({ ok: false, message: 'Ese sonido ya no existe en la biblioteca.' });
          return;
        }

        const playbackId = `${socket.id}:${now}`;
        const activeSounds = socket.data.activeSounds instanceof Map ? socket.data.activeSounds : new Map();
        const previousPlaybackId = activeSounds.get(sound.id);
        if (previousPlaybackId) io.to(overlayRoom(joined.channelId)).emit('sound-stop', { playbackId: previousPlaybackId });
        activeSounds.set(sound.id, playbackId);
        socket.data.activeSounds = activeSounds;

        const event = {
          soundId: sound.id,
          version: sound.version,
          scope: sound.scope || 'library',
          playbackId
        };

        io.to(overlayRoom(joined.channelId)).emit('sound-play', event);
        reply?.({ ok: true, playbackId });
      } catch (error) {
        logger.error('Falló el disparo de sonido por socket', { socketId: socket.id, userId: joined?.userId, channelId: joined?.channelId, error: error.message });
        reply?.({ ok: false, message: 'No fue posible reproducir el sonido.' });
      }
    });

    socket.on('sound-stop', async (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : null;
      if (!joined || joined.role !== 'editor') {
        socket.emit('access-denied');
        reply?.({ ok: false, message: 'Acceso denegado' });
        return;
      }

      try {
        if (!(await revalidateInteractiveAccess(joined))) {
          socket.emit('access-revoked', { publicKey: joined.publicKey, reason: 'authorization-changed' });
          socket.disconnect(true);
          reply?.({ ok: false, message: 'Tu acceso ya no es válido' });
          return;
        }

        const soundId = typeof payload?.soundId === 'string' ? payload.soundId : '';
        const activeSounds = socket.data.activeSounds instanceof Map ? socket.data.activeSounds : new Map();
        const playbackId = activeSounds.get(soundId);
        if (playbackId) {
          activeSounds.delete(soundId);
          io.to(overlayRoom(joined.channelId)).emit('sound-stop', { playbackId });
        }
        reply?.({ ok: true });
      } catch (error) {
        logger.error('Falló la detención de sonido por socket', { socketId: socket.id, userId: joined?.userId, channelId: joined?.channelId, error: error.message });
        reply?.({ ok: false, message: 'No fue posible detener el sonido.' });
      }
    });

    edit('cursor-move', (context, payload) => {
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > EDITOR_CURSOR_LIMIT || Math.abs(y) > EDITOR_CURSOR_LIMIT) return;
      socket.to(editorRoom(context.channelId)).volatile.compress(false).emit('cursor-move', {
        socketId: socket.id,
        x,
        y,
        at: Date.now()
      });
    }, { minIntervalMs: SOCKET_PREVIEW_MIN_INTERVAL_MS, rateKey: 'cursor-move' });

    edit('cursor-leave', (context) => {
      socket.to(editorRoom(context.channelId)).volatile.compress(false).emit('cursor-leave', { socketId: socket.id });
    });

    edit('live-mode-set', (context, payload, reply) => {
      const enabled = Boolean(payload?.enabled);
      const previous = getChannelControl(context.channelId);

      if (!enabled && previous.liveRequired) {
        reply?.({ ok: false, message: 'Modo Live es obligatorio mientras haya otro colaborador conectado.' });
        return;
      }

      const control = setLiveEnabled(context.channelId, enabled, socket.id);

      if (enabled && !previous.liveEnabled) {
        // Publicar + habilitar colaboración se procesa como una sola transición.
        // Los editores bloqueados se habilitan sólo después de que el overlay recibió la escena.
        io.to(overlayRoom(context.channelId)).emit('sync-state', { objects: getPublishedChannelState(context.channelId) });
      }

      emitControl(io, context.channelId);
      emitPresence(io, context.channelId);
      logger.info(enabled ? 'Canal cambió a modo Live' : 'Canal cambió a modo Estudio', { channelId: context.channelId, userId: context.userId });
      reply?.({ ok: true, control });
    });

    edit('publish-scene', (context, _payload, reply) => {
      const objects = publishChannelState(context.channelId);
      io.to(overlayRoom(context.channelId)).emit('sync-state', { objects });
      emitControl(io, context.channelId);
      logger.info('Escena publicada al overlay', { channelId: context.channelId, userId: context.userId, count: objects.length });
      reply?.({ ok: true, count: objects.length, control: getChannelControl(context.channelId) });
    });

    edit('panic-set', (context, payload, reply) => {
      if (!context.isOwner) {
        reply?.({ ok: false, message: 'Sólo el propietario puede apagar o encender el overlay.' });
        return;
      }

      const hidden = Boolean(payload?.hidden);
      const control = setOverlayHidden(context.channelId, hidden);
      io.to(overlayRoom(context.channelId)).emit('overlay-visibility', { hidden });
      emitControl(io, context.channelId);
      logger.warn(hidden ? 'Overlay apagado por el propietario' : 'Overlay encendido por el propietario', { channelId: context.channelId, userId: context.userId });
      reply?.({ ok: true, control });
    }, { allowWhenBlocked: true });

    socket.on('disconnect', () => {
      if (!joined || socket.data?.channelDeleted) return;
      const result = disconnectRole(joined.channelId, socket.id, io);
      if (joined.role === 'editor') {
        socket.to(editorRoom(joined.channelId)).emit('cursor-leave', { socketId: socket.id });
        if (result.forcedLive) {
          io.to(overlayRoom(joined.channelId)).emit('sync-state', { objects: result.publishedObjects || [] });
          io.to(editorRoom(joined.channelId)).emit('channel-control', result.control);
          io.to(editorRoom(joined.channelId)).emit('studio-forced-live', {
            message: 'El editor que estaba en modo Estudio se desconectó. TRAZIO publicó el workspace y volvió a Live para no bloquear al equipo.'
          });
        }
      }
      emitPresence(io, joined.channelId);
    });
  });
}
