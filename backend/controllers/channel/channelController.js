import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import { db, models } from '../../models/index.js';
import { createInvitation, acceptInvitation, acceptInvitationByUuid, listPendingInvitations, rejectInvitationByUuid } from '../../services/channelInvitationService.js';
import { getCanvasLimitForUser } from '../../services/channelLimitService.js';
import { destroyChannelRuntime, getChannelRuntimeSnapshot } from '../../services/channelRuntimeService.js';
import { isPublicUuid } from '../../services/channelAccessService.js';
import logger from '../../helpers/winston.js';

function normalizeChannelUrl(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  const candidate = /^[a-z][a-z0-9+.-]*:\/\//i.test(raw) ? raw : `https://${raw}`;
  let url;
  try { url = new URL(candidate); } catch { throw Object.assign(new Error('El link del canal no es válido'), { status: 400 }); }
  if (!['http:', 'https:'].includes(url.protocol)) throw Object.assign(new Error('El link del canal debe usar http o https'), { status: 400 });
  const normalized = url.toString();
  if (normalized.length > 500) throw Object.assign(new Error('El link del canal es demasiado largo'), { status: 400 });
  return normalized;
}

function detectPlatform(channelUrl) {
  if (!channelUrl) return null;
  try {
    const host = new URL(channelUrl).hostname.toLowerCase().replace(/^www\./, '');
    if (host === 'twitch.tv' || host.endsWith('.twitch.tv')) return 'twitch';
    if (host === 'youtube.com' || host.endsWith('.youtube.com') || host === 'youtu.be') return 'youtube';
    if (host === 'kick.com' || host.endsWith('.kick.com')) return 'kick';
    return 'web';
  } catch { return null; }
}

function publicRuntime(channelId, { includeEditorUsers = true } = {}) {
  const { control, presence } = getChannelRuntimeSnapshot(channelId);
  const uniqueEditors = includeEditorUsers
    ? Array.from(new Map(presence.editorList.map((editor) => [editor.userUuid || editor.socketId, editor])).values())
    : [];
  return {
    liveEnabled: control.liveEnabled,
    overlayHidden: control.overlayHidden,
    hasDraftChanges: control.hasDraftChanges,
    editorCount: presence.editors,
    overlayCount: presence.overlays,
    editorUsers: uniqueEditors.map((editor) => ({
      username: editor.username,
      displayName: editor.displayName,
      avatarUrl: editor.avatarUrl || null,
      colorSlot: editor.colorSlot,
      isOwner: Boolean(editor.isOwner),
      canEdit: Boolean(editor.canEdit)
    }))
  };
}

async function channelStats(channel, runtimeOptions = undefined) {
  const [collaboratorCount, activeCollaboratorCount, savedDesignCount] = await Promise.all([
    models.ChannelCollaborator.count({ where: { channelId: channel.id } }),
    models.ChannelCollaborator.count({ where: { channelId: channel.id, canEdit: true } }),
    models.SavedDesign.count({ where: { channelId: channel.id } })
  ]);
  return { collaboratorCount, activeCollaboratorCount, savedDesignCount, runtime: publicRuntime(channel.id, runtimeOptions) };
}

async function channelPreferencesFor(userId, channelIds) {
  if (!channelIds.length) return new Map();
  const rows = await models.ChannelUserPreference.findAll({ where: { userId, channelId: { [Op.in]: channelIds } } });
  return new Map(rows.map((row) => [Number(row.channelId), row]));
}

function publicChannel(channel, extras = {}, preference = null) {
  return {
    uuid: channel.uuid,
    name: channel.name,
    platform: channel.platform,
    channelUrl: channel.channelUrl,
    publicKey: channel.publicKey,
    createdAt: channel.createdAt,
    updatedAt: channel.updatedAt,
    ...extras,
    isFavorite: Boolean(preference?.isFavorite),
    lastUsedAt: preference?.lastUsedAt || null
  };
}

function publicCollaborator(row, user = row.user) {
  return {
    canEdit: Boolean(row.canEdit),
    createdAt: row.createdAt,
    user: user ? {
      uuid: user.uuid,
      username: user.username,
      email: user.email,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl
    } : null
  };
}

async function getChannelVisibleToUser(userId, channelUuid) {
  if (!isPublicUuid(channelUuid)) return null;
  const channel = await models.Channel.findOne({ where: { uuid: channelUuid } });
  if (!channel) return null;
  if (Number(channel.ownerId) === Number(userId)) return channel;
  const collaboration = await models.ChannelCollaborator.findOne({ where: { channelId: channel.id, userId } });
  return collaboration ? channel : null;
}

async function disconnectInteractiveSocketsForUser(req, channel, userId, reason) {
  const io = req.app.get('io');
  if (!io) return;
  const sockets = await io.in(`user:${userId}`).fetchSockets();
  for (const editorSocket of sockets) {
    if (!['editor', 'soundboard'].includes(editorSocket.data?.role) || Number(editorSocket.data?.channelId) !== Number(channel.id)) continue;
    editorSocket.emit('access-revoked', { channelUuid: channel.uuid, publicKey: channel.publicKey, reason });
    editorSocket.disconnect(true);
  }
}

export class ChannelController {
  static async mine(req, res) {
    const [ownedRows, collaborationRows] = await Promise.all([
      models.Channel.findAll({ where: { ownerId: req.user.id }, order: [['createdAt', 'ASC']] }),
      models.ChannelCollaborator.findAll({
        where: { userId: req.user.id },
        include: [{ model: models.Channel, as: 'channel' }],
        order: [['createdAt', 'ASC']]
      })
    ]);

    const channelIds = [
      ...ownedRows.map((channel) => Number(channel.id)),
      ...collaborationRows.map((row) => Number(row.channelId))
    ];
    const preferences = await channelPreferencesFor(req.user.id, channelIds);

    const ownedChannels = await Promise.all(ownedRows.map(async (channel) => publicChannel(
      channel,
      await channelStats(channel),
      preferences.get(Number(channel.id))
    )));
    const collaborations = await Promise.all(collaborationRows.map(async (row) => publicChannel(
      row.channel,
      {
        ...(await channelStats(row.channel, { includeEditorUsers: Boolean(row.canEdit) })),
        collaboration: { canEdit: Boolean(row.canEdit) }
      },
      preferences.get(Number(row.channelId))
    )));

    const limit = getCanvasLimitForUser(req.user);
    res.json({
      owned: ownedChannels[0] || null,
      ownedChannels,
      collaborations,
      limits: { canvases: limit, used: ownedChannels.length, remaining: Math.max(0, limit - ownedChannels.length) }
    });
  }

  static async setPreference(req, res) {
    const channelUuid = String(req.params.channelUuid || '').trim();
    if (!isPublicUuid(channelUuid)) return res.status(400).json({ message: 'Identificador de lienzo inválido' });
    const channel = await getChannelVisibleToUser(req.user.id, channelUuid);
    if (!channel) return res.status(403).json({ message: 'No tienes acceso a este lienzo' });
    if (typeof req.body?.isFavorite !== 'boolean') return res.status(400).json({ message: 'isFavorite debe ser booleano' });

    const [preference] = await models.ChannelUserPreference.findOrCreate({
      where: { userId: req.user.id, channelId: channel.id },
      defaults: { isFavorite: req.body.isFavorite }
    });
    if (Boolean(preference.isFavorite) !== req.body.isFavorite) await preference.update({ isFavorite: req.body.isFavorite });

    res.json({ channelUuid, isFavorite: Boolean(preference.isFavorite), lastUsedAt: preference.lastUsedAt || null });
  }

  static async markUsed(req, res) {
    const channelId = Number(req.channel.id);
    const now = new Date();
    const [preference] = await models.ChannelUserPreference.findOrCreate({
      where: { userId: req.user.id, channelId },
      defaults: { lastUsedAt: now }
    });
    if (!preference.lastUsedAt || Number(preference.lastUsedAt) !== Number(now)) await preference.update({ lastUsedAt: now });
    res.json({ channelUuid: req.channel.uuid, isFavorite: Boolean(preference.isFavorite), lastUsedAt: preference.lastUsedAt });
  }

  static async featured(req, res) {
    const rows = await models.Channel.findAll({
      where: { channelUrl: { [Op.ne]: null } },
      attributes: ['id', 'uuid', 'name', 'platform', 'channelUrl'],
      order: [['id', 'ASC']]
    });
    const candidates = rows.filter((row) => {
      try { return ['http:', 'https:'].includes(new URL(row.channelUrl).protocol); } catch { return false; }
    });
    if (!candidates.length) return res.json({ channel: null });

    const day = new Date().toISOString().slice(0, 10);
    const seed = crypto.createHash('sha256').update(`TRAZIO-featured:${day}`).digest().readUInt32BE(0);
    const selected = candidates[seed % candidates.length];
    res.json({ channel: { uuid: selected.uuid, name: selected.name, platform: selected.platform, channelUrl: selected.channelUrl } });
  }

  static async create(req, res) {
    const limit = getCanvasLimitForUser(req.user);
    const current = await models.Channel.count({ where: { ownerId: req.user.id } });
    if (current >= limit) return res.status(403).json({ code: 'CANVAS_LIMIT_REACHED', message: `Tu plan permite hasta ${limit} lienzo${limit === 1 ? '' : 's'}.`, limit, used: current });

    const name = String(req.body.name || '').trim();
    if (!name) return res.status(400).json({ message: 'El nombre del lienzo es obligatorio' });
    if (name.length > 120) return res.status(400).json({ message: 'El nombre del lienzo es demasiado largo' });
    const channelUrl = normalizeChannelUrl(req.body.channelUrl);
    const channel = await models.Channel.create({
      ownerId: req.user.id,
      name,
      platform: detectPlatform(channelUrl),
      channelUrl,
      publicKey: crypto.randomBytes(24).toString('hex')
    });
    logger.info('Lienzo creado', { channelId: channel.id, ownerId: req.user.id });
    res.status(201).json(publicChannel(channel, { collaboratorCount: 0, activeCollaboratorCount: 0, savedDesignCount: 0, runtime: publicRuntime(channel.id) }));
  }

  static async update(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede cambiar estos datos' });
    const nextName = req.body.name === undefined ? req.channel.name : String(req.body.name || '').trim();
    if (!nextName) return res.status(400).json({ message: 'El nombre del lienzo es obligatorio' });
    const channelUrl = req.body.channelUrl === undefined ? req.channel.channelUrl : normalizeChannelUrl(req.body.channelUrl);
    await req.channel.update({ name: nextName, platform: detectPlatform(channelUrl), channelUrl });
    res.json(publicChannel(req.channel, await channelStats(req.channel)));
  }

  static async invite(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede invitar colaboradores' });
    const invitation = await createInvitation(req.channel, req.user, req.body.email);
    res.status(201).json({ uuid: invitation.uuid, email: invitation.email, expiresAt: invitation.expiresAt });
  }

  static async accept(req, res) {
    const result = await acceptInvitation(req.body.token, req.user);
    res.json({ status: result.status, message: result.message, channelUuid: result.invitation.channel?.uuid || null, publicKey: result.invitation.channel?.publicKey || null });
  }

  static async pendingInvitations(req, res) {
    const invitations = await listPendingInvitations(req.user);
    res.json({
      count: invitations.length,
      invitations: invitations.map((row) => ({
        uuid: row.uuid,
        email: row.email,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        channel: row.channel ? {
          uuid: row.channel.uuid,
          name: row.channel.name,
          platform: row.channel.platform,
          channelUrl: row.channel.channelUrl,
          publicKey: row.channel.publicKey
        } : null,
        inviter: row.inviter ? {
          uuid: row.inviter.uuid,
          username: row.inviter.username,
          displayName: row.inviter.displayName,
          avatarUrl: row.inviter.avatarUrl
        } : null
      }))
    });
  }

  static async acceptPendingInvitation(req, res) {
    const result = await acceptInvitationByUuid(req.params.invitationUuid, req.user);
    res.json({ status: result.status, message: result.message, channelUuid: result.invitation.channel?.uuid || null, publicKey: result.invitation.channel?.publicKey || null });
  }

  static async rejectPendingInvitation(req, res) {
    const result = await rejectInvitationByUuid(req.params.invitationUuid, req.user);
    res.json({ status: result.status, message: result.message, channelUuid: result.invitation.channel?.uuid || null });
  }

  static async collaborators(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    const rows = await models.ChannelCollaborator.findAll({
      where: { channelId: req.channel.id },
      include: [{ model: models.User, as: 'user', attributes: ['uuid', 'username', 'email', 'displayName', 'avatarUrl'] }],
      order: [['canEdit', 'DESC'], ['createdAt', 'ASC']]
    });
    res.json(rows.map((row) => publicCollaborator(row)));
  }

  static async setCollaboratorAccess(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    if (typeof req.body.canEdit !== 'boolean') return res.status(400).json({ message: 'canEdit debe ser booleano' });
    if (!isPublicUuid(req.params.userUuid)) return res.status(400).json({ message: 'Identificador de usuario inválido' });

    const user = await models.User.findOne({ where: { uuid: req.params.userUuid }, attributes: ['id', 'uuid', 'username', 'email', 'displayName', 'avatarUrl'] });
    if (!user) return res.status(404).json({ message: 'Colaborador no encontrado' });
    const row = await models.ChannelCollaborator.findOne({ where: { channelId: req.channel.id, userId: user.id } });
    if (!row) return res.status(404).json({ message: 'Colaborador no encontrado' });

    await row.update({ canEdit: req.body.canEdit });
    if (!req.body.canEdit) await disconnectInteractiveSocketsForUser(req, req.channel, row.userId, 'collaboration-suspended');
    logger.info(req.body.canEdit ? 'Colaborador reactivado' : 'Colaborador suspendido', { channelId: req.channel.id, userId: row.userId, ownerId: req.user.id });
    res.json(publicCollaborator(row, user));
  }

  static async remove(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede eliminar este lienzo' });

    const confirmation = String(req.body?.confirmation || '');
    const expected = `${req.channel.name} BORRAR`;
    if (confirmation !== expected) return res.status(400).json({ message: `Escribe exactamente: ${expected}` });

    const channelId = Number(req.channel.id);
    const channelUuid = req.channel.uuid;
    const publicKey = req.channel.publicKey;
    const io = req.app.get('io');

    await db.transaction(async (transaction) => {
      await models.ChannelInvitation.destroy({ where: { channelId }, transaction });
      await models.ChannelCollaborator.destroy({ where: { channelId }, transaction });
      await models.SavedDesign.destroy({ where: { channelId }, transaction });
      await models.ChannelUserPreference.destroy({ where: { channelId }, transaction });
      await models.Channel.destroy({ where: { id: channelId, ownerId: req.user.id }, transaction });
    });

    if (io) {
      const sockets = await io.in(`channel:${channelId}`).fetchSockets();
      for (const channelSocket of sockets) {
        channelSocket.data.channelDeleted = true;
        channelSocket.emit('channel-deleted', { channelUuid, publicKey, message: 'Este lienzo fue eliminado por su propietario.' });
        if (['editor', 'soundboard'].includes(channelSocket.data?.role)) channelSocket.emit('access-revoked', { channelUuid, publicKey, reason: 'channel-deleted' });
        channelSocket.disconnect(true);
      }
    }

    destroyChannelRuntime(channelId);

    const uploadRoot = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');
    try {
      await fs.rm(path.join(uploadRoot, String(channelId)), { recursive: true, force: true });
    } catch (error) {
      logger.warn('Lienzo eliminado, pero no fue posible limpiar todos sus uploads', { channelId, error: error.message });
    }

    logger.warn('Lienzo eliminado permanentemente', { channelId, ownerId: req.user.id, name: req.channel.name });
    res.status(204).end();
  }

  static async leave(req, res) {
    const channelUuid = String(req.params.channelUuid || '').trim();
    if (!isPublicUuid(channelUuid)) return res.status(400).json({ message: 'Identificador de lienzo inválido' });
    const channel = await models.Channel.findOne({ where: { uuid: channelUuid } });
    if (!channel) return res.status(404).json({ message: 'Lienzo no encontrado' });
    if (Number(channel.ownerId) === Number(req.user.id)) return res.status(400).json({ message: 'El propietario no puede abandonar su propio lienzo' });

    const collaboration = await models.ChannelCollaborator.findOne({ where: { channelId: channel.id, userId: req.user.id } });
    if (!collaboration) return res.status(404).json({ message: 'No eres colaborador de este lienzo' });
    await collaboration.destroy();
    await models.ChannelUserPreference.destroy({ where: { channelId: channel.id, userId: req.user.id } });

    const io = req.app.get('io');
    if (io) {
      const sockets = await io.in(`user:${req.user.id}`).fetchSockets();
      for (const editorSocket of sockets) {
        if (!['editor', 'soundboard'].includes(editorSocket.data?.role) || Number(editorSocket.data?.channelId) !== Number(channel.id)) continue;
        editorSocket.emit('access-revoked', { channelUuid: channel.uuid, publicKey: channel.publicKey, reason: 'collaboration-left' });
        editorSocket.disconnect(true);
      }
    }

    logger.info('Colaborador abandonó un lienzo', { channelId: channel.id, userId: req.user.id });
    res.status(204).end();
  }

  static async removeCollaborator(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    if (!isPublicUuid(req.params.userUuid)) return res.status(400).json({ message: 'Identificador de usuario inválido' });
    const user = await models.User.findOne({ where: { uuid: req.params.userUuid }, attributes: ['id'] });
    if (!user) return res.status(404).json({ message: 'Colaborador no encontrado' });
    const collaboration = await models.ChannelCollaborator.findOne({ where: { channelId: req.channel.id, userId: user.id } });
    if (!collaboration) return res.status(404).json({ message: 'Colaborador no encontrado' });

    await db.transaction(async (transaction) => {
      await collaboration.destroy({ transaction });
      await models.ChannelUserPreference.destroy({ where: { channelId: req.channel.id, userId: user.id }, transaction });
    });
    await disconnectInteractiveSocketsForUser(req, req.channel, user.id, 'collaboration-removed');
    logger.info('Colaborador eliminado de un lienzo', { channelId: req.channel.id, userId: user.id, ownerId: req.user.id });
    res.status(204).end();
  }
}
