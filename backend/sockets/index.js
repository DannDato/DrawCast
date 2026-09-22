import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { models } from '../models/index.js';
import { env } from '../config/env.js';
import { sha256 } from '../helpers/security.js';
import { getEditableChannel, getEditableChannelByPublicKey } from '../services/channelAccessService.js';
import {
  clearObjects,
  connectRole,
  disconnectRole,
  getChannelControl,
  getChannelPresence,
  getChannelState,
  getEditorAccess,
  getPublishedChannelState,
  publishChannelState,
  removeObject,
  replaceObjects,
  setLiveEnabled,
  setObject,
  setOverlayHidden
} from '../services/channelRuntimeService.js';
import logger from '../helpers/winston.js';

const room = (channelId) => `channel:${channelId}`;
const editorRoom = (channelId) => `channel:${channelId}:editors`;
const overlayRoom = (channelId) => `channel:${channelId}:overlays`;
const EDITOR_CURSOR_LIMIT = 100000;

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

      joined = { channelId: channel.id, channelUuid: channel.uuid, role: 'editor', userId: user.id, sessionId: session.id, isOwner, authorizedAt: Date.now() };
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

      try {
        // Revalida sesión y permisos durante la conexión. La ventana corta evita
        // golpear la BD en cada movimiento de cursor; revocaciones normales además
        // desconectan el socket inmediatamente desde sus controladores HTTP.
        if (Date.now() - joined.authorizedAt > 1000) {
          const [session, channel] = await Promise.all([
            models.Session.findOne({ where: { id: joined.sessionId, userId: joined.userId, revokedAt: null } }),
            getEditableChannel(joined.userId, joined.channelUuid)
          ]);
          if (!session || session.expiresAt <= new Date() || !channel) {
            socket.emit('access-revoked', { reason: 'authorization-changed' });
            socket.disconnect(true);
            reply?.({ ok: false, message: 'Tu acceso ya no es válido' });
            return;
          }
          joined.authorizedAt = Date.now();
        }
      } catch (error) {
        logger.warn('No fue posible revalidar un socket de editor', { socketId: socket.id, userId: joined.userId, error: error.message });
        socket.disconnect(true);
        reply?.({ ok: false, message: 'No fue posible validar tu acceso' });
        return;
      }

      if (!options.allowWhenBlocked && !canUseWorkspace(joined, socket, reply)) return;
      handler(joined, payload, reply);
    });

    edit('obj-upsert', (context, object) => {
      if (!validObject(object)) return;
      const before = getChannelControl(context.channelId);
      setObject(context.channelId, object);
      emitWorkspaceChange(io, socket, context.channelId, 'obj-upsert', object, before);
    });

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
      socket.to(editorRoom(context.channelId)).emit('draw-live', payload);
      if (getChannelControl(context.channelId).liveEnabled) io.to(overlayRoom(context.channelId)).emit('draw-live', payload);
    });

    edit('cursor-move', (context, payload) => {
      const x = Number(payload?.x);
      const y = Number(payload?.y);
      if (!Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > EDITOR_CURSOR_LIMIT || Math.abs(y) > EDITOR_CURSOR_LIMIT) return;
      socket.to(editorRoom(context.channelId)).volatile.emit('cursor-move', {
        socketId: socket.id,
        x,
        y,
        at: Date.now()
      });
    });

    edit('cursor-leave', (context) => {
      socket.to(editorRoom(context.channelId)).volatile.emit('cursor-leave', { socketId: socket.id });
    });

    edit('live-mode-set', (context, payload, reply) => {
      const enabled = Boolean(payload?.enabled);
      const previous = getChannelControl(context.channelId);

      if (!enabled && previous.editorCount > 1) {
        reply?.({ ok: false, message: 'Modo Live es obligatorio mientras haya más de un editor conectado.' });
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
