import jwt from 'jsonwebtoken';
import { parse as parseCookie } from 'cookie';
import { models } from '../models/index.js';
import { env } from '../config/env.js';
import { sha256 } from '../helpers/security.js';
import { getEditableChannelByPublicKey } from '../services/channelAccessService.js';
import {
  clearObjects,
  connectRole,
  disconnectRole,
  getChannelControl,
  getChannelState,
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

async function socketUser(socket) {
  try {
    const cookies = parseCookie(socket.handshake.headers.cookie || '');
    const token = cookies[env.cookieName];
    if (!token) return null;
    const decoded = jwt.verify(token, env.jwtSecret, { issuer: 'fullstack-base' });
    const session = await models.Session.findOne({ where: { id: decoded.sid, userId: decoded.sub, tokenHash: sha256(token), revokedAt: null } });
    if (!session || session.expiresAt <= new Date()) return null;
    return models.User.findByPk(decoded.sub);
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

function emitWorkspaceChange(io, socket, channelId, event, payload, controlBefore) {
  socket.to(editorRoom(channelId)).emit(event, payload);
  const control = getChannelControl(channelId);
  if (control.liveEnabled) io.to(overlayRoom(channelId)).emit(event, payload);
  if (controlBefore.hasDraftChanges !== control.hasDraftChanges) emitControl(io, channelId);
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
      connectRole(channel.id, socket.id, 'overlay', io);
      socket.emit('overlay-visibility', { hidden: getChannelControl(channel.id).overlayHidden });
      socket.emit('sync-state', { objects: getPublishedChannelState(channel.id) });
    });

    socket.on('join-editor', async ({ publicKey } = {}) => {
      const user = await socketUser(socket);
      if (!user) return socket.emit('access-denied');

      const channel = await getEditableChannelByPublicKey(user.id, String(publicKey || ''));
      if (!channel) return socket.emit('access-denied');

      joined = {
        channelId: channel.id,
        role: 'editor',
        userId: user.id,
        isOwner: Number(channel.ownerId) === Number(user.id)
      };
      socket.join(room(channel.id));
      socket.join(editorRoom(channel.id));
      connectRole(channel.id, socket.id, 'editor', io);
      socket.emit('sync-state', { objects: getChannelState(channel.id) });
      socket.emit('channel-control', getChannelControl(channel.id));
      logger.info('Editor conectado al canal', { channelId: channel.id, userId: user.id, isOwner: joined.isOwner });
    });

    const edit = (event, handler) => socket.on(event, (payload, ack) => {
      const reply = typeof ack === 'function' ? ack : null;
      if (!joined || joined.role !== 'editor') {
        socket.emit('access-denied');
        reply?.({ ok: false, message: 'Acceso denegado' });
        return;
      }
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
      removeObject(context.channelId, payload.id);
      emitWorkspaceChange(io, socket, context.channelId, 'obj-remove', { id: payload.id }, before);
    });

    edit('clear-all', (context) => {
      const before = getChannelControl(context.channelId);
      clearObjects(context.channelId);
      io.to(editorRoom(context.channelId)).emit('clear-all');
      if (getChannelControl(context.channelId).liveEnabled) io.to(overlayRoom(context.channelId)).emit('clear-all');
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

    edit('live-mode-set', (context, payload, reply) => {
      const enabled = Boolean(payload?.enabled);
      const previous = getChannelControl(context.channelId);
      const control = setLiveEnabled(context.channelId, enabled);

      if (enabled && !previous.liveEnabled) {
        io.to(overlayRoom(context.channelId)).emit('sync-state', { objects: getPublishedChannelState(context.channelId) });
      }

      emitControl(io, context.channelId);
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
        reply?.({ ok: false, message: 'Sólo el propietario puede usar el botón de pánico.' });
        return;
      }

      const hidden = Boolean(payload?.hidden);
      const control = setOverlayHidden(context.channelId, hidden);
      io.to(overlayRoom(context.channelId)).emit('overlay-visibility', { hidden });
      emitControl(io, context.channelId);
      logger.warn(hidden ? 'Overlay ocultado con botón de pánico' : 'Overlay restaurado tras botón de pánico', { channelId: context.channelId, userId: context.userId });
      reply?.({ ok: true, control });
    });

    socket.on('disconnect', () => {
      if (joined) disconnectRole(joined.channelId, socket.id, io);
    });
  });
}
