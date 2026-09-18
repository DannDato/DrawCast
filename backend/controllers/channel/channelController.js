import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Op } from 'sequelize';
import { db, models } from '../../models/index.js';
import { createInvitation, acceptInvitation, acceptInvitationById, listPendingInvitations, rejectInvitationById } from '../../services/channelInvitationService.js';
import { getCanvasLimitForUser } from '../../services/channelLimitService.js';
import { destroyChannelRuntime, getChannelControl, getChannelPresence } from '../../services/channelRuntimeService.js';
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

async function ownedChannelsFor(userId) {
  const rows = await models.Channel.findAll({ where: { ownerId: userId }, order: [['createdAt', 'ASC']] });
  return Promise.all(rows.map(async (channel) => {
    const [collaboratorCount, activeCollaboratorCount, savedDesignCount] = await Promise.all([
      models.ChannelCollaborator.count({ where: { channelId: channel.id } }),
      models.ChannelCollaborator.count({ where: { channelId: channel.id, canEdit: true } }),
      models.SavedDesign.count({ where: { channelId: channel.id } })
    ]);
    const control = getChannelControl(channel.id);
    const presence = getChannelPresence(channel.id);
    return {
      ...channel.toJSON(),
      collaboratorCount,
      activeCollaboratorCount,
      savedDesignCount,
      runtime: {
        liveEnabled: control.liveEnabled,
        overlayHidden: control.overlayHidden,
        hasDraftChanges: control.hasDraftChanges,
        editorCount: presence.editors,
        overlayCount: presence.overlays
      }
    };
  }));
}

export class ChannelController {
  static async mine(req, res) {
    const ownedChannels = await ownedChannelsFor(req.user.id);
    const collaborations = await models.ChannelCollaborator.findAll({
      where: { userId: req.user.id },
      include: [{ model: models.Channel, as: 'channel' }],
      order: [['createdAt', 'ASC']]
    });
    const limit = getCanvasLimitForUser(req.user);
    res.json({
      owned: ownedChannels[0] || null,
      ownedChannels,
      collaborations: collaborations.map((row) => ({ ...row.channel.toJSON(), collaboration: { canEdit: Boolean(row.canEdit) } })),
      limits: { canvases: limit, used: ownedChannels.length, remaining: Math.max(0, limit - ownedChannels.length) }
    });
  }

  static async featured(req, res) {
    const rows = await models.Channel.findAll({
      where: { channelUrl: { [Op.ne]: null } },
      attributes: ['id', 'name', 'platform', 'channelUrl'],
      order: [['id', 'ASC']]
    });
    const candidates = rows.filter((row) => {
      try { return ['http:', 'https:'].includes(new URL(row.channelUrl).protocol); } catch { return false; }
    });
    if (!candidates.length) return res.json({ channel: null });

    const day = new Date().toISOString().slice(0, 10);
    const seed = crypto.createHash('sha256').update(`drawcast-featured:${day}`).digest().readUInt32BE(0);
    res.json({ channel: candidates[seed % candidates.length] });
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
    res.status(201).json(channel);
  }

  static async update(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede cambiar estos datos' });
    const nextName = req.body.name === undefined ? req.channel.name : String(req.body.name || '').trim();
    if (!nextName) return res.status(400).json({ message: 'El nombre del lienzo es obligatorio' });
    const channelUrl = req.body.channelUrl === undefined ? req.channel.channelUrl : normalizeChannelUrl(req.body.channelUrl);
    await req.channel.update({ name: nextName, platform: detectPlatform(channelUrl), channelUrl });
    res.json(req.channel);
  }

  static async invite(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede invitar colaboradores' });
    const invitation = await createInvitation(req.channel, req.user, req.body.email);
    res.status(201).json({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt });
  }

  static async accept(req, res) {
    const result = await acceptInvitation(req.body.token, req.user);
    res.json({ status: result.status, message: result.message, channelId: result.invitation.channelId, publicKey: result.invitation.channel?.publicKey || null });
  }

  static async pendingInvitations(req, res) {
    const invitations = await listPendingInvitations(req.user);
    res.json({
      count: invitations.length,
      invitations: invitations.map((row) => ({
        id: row.id,
        email: row.email,
        expiresAt: row.expiresAt,
        createdAt: row.createdAt,
        channel: row.channel ? {
          id: row.channel.id,
          name: row.channel.name,
          platform: row.channel.platform,
          channelUrl: row.channel.channelUrl,
          publicKey: row.channel.publicKey
        } : null,
        inviter: row.inviter ? {
          id: row.inviter.id,
          username: row.inviter.username,
          displayName: row.inviter.displayName,
          avatarUrl: row.inviter.avatarUrl
        } : null
      }))
    });
  }

  static async acceptPendingInvitation(req, res) {
    const result = await acceptInvitationById(Number(req.params.invitationId), req.user);
    res.json({ status: result.status, message: result.message, channelId: result.invitation.channelId, publicKey: result.invitation.channel?.publicKey || null });
  }

  static async rejectPendingInvitation(req, res) {
    const result = await rejectInvitationById(Number(req.params.invitationId), req.user);
    res.json({ status: result.status, message: result.message, channelId: result.invitation.channelId });
  }

  static async collaborators(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    const rows = await models.ChannelCollaborator.findAll({
      where: { channelId: req.channel.id },
      include: [{ model: models.User, as: 'user', attributes: ['id', 'username', 'email', 'displayName', 'avatarUrl'] }],
      order: [['canEdit', 'DESC'], ['createdAt', 'ASC']]
    });
    res.json(rows);
  }

  static async setCollaboratorAccess(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    if (typeof req.body.canEdit !== 'boolean') return res.status(400).json({ message: 'canEdit debe ser booleano' });
    const row = await models.ChannelCollaborator.findOne({ where: { channelId: req.channel.id, userId: Number(req.params.userId) } });
    if (!row) return res.status(404).json({ message: 'Colaborador no encontrado' });
    await row.update({ canEdit: req.body.canEdit });
    if (!req.body.canEdit) {
      const io = req.app.get('io');
      if (io) {
        const sockets = await io.in(`user:${row.userId}`).fetchSockets();
        for (const editorSocket of sockets) {
          if (editorSocket.data?.role === 'editor' && Number(editorSocket.data?.channelId) === Number(req.channel.id)) {
            editorSocket.emit('access-revoked', { channelId: req.channel.id, publicKey: req.channel.publicKey });
            editorSocket.disconnect(true);
          }
        }
      }
    }
    logger.info(req.body.canEdit ? 'Colaborador reactivado' : 'Colaborador suspendido', { channelId: req.channel.id, userId: row.userId, ownerId: req.user.id });
    res.json(row);
  }


  static async remove(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede eliminar este lienzo' });

    const confirmation = String(req.body?.confirmation || '');
    const expected = `${req.channel.name} BORRAR`;
    if (confirmation !== expected) return res.status(400).json({ message: `Escribe exactamente: ${expected}` });

    const channelId = Number(req.channel.id);
    const publicKey = req.channel.publicKey;
    const io = req.app.get('io');

    await db.transaction(async (transaction) => {
      await models.ChannelInvitation.destroy({ where: { channelId }, transaction });
      await models.ChannelCollaborator.destroy({ where: { channelId }, transaction });
      await models.SavedDesign.destroy({ where: { channelId }, transaction });
      await models.Channel.destroy({ where: { id: channelId, ownerId: req.user.id }, transaction });
    });

    if (io) {
      const sockets = await io.in(`channel:${channelId}`).fetchSockets();
      for (const channelSocket of sockets) {
        channelSocket.data.channelDeleted = true;
        channelSocket.emit('channel-deleted', { channelId, publicKey, message: 'Este lienzo fue eliminado por su propietario.' });
        if (channelSocket.data?.role === 'editor') channelSocket.emit('access-revoked', { channelId, publicKey, reason: 'channel-deleted' });
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
    const channelId = Number(req.params.channelId);
    const channel = await models.Channel.findByPk(channelId);
    if (!channel) return res.status(404).json({ message: 'Lienzo no encontrado' });
    if (Number(channel.ownerId) === Number(req.user.id)) return res.status(400).json({ message: 'El propietario no puede abandonar su propio lienzo' });

    const collaboration = await models.ChannelCollaborator.findOne({ where: { channelId, userId: req.user.id } });
    if (!collaboration) return res.status(404).json({ message: 'No eres colaborador de este lienzo' });
    await collaboration.destroy();

    const io = req.app.get('io');
    if (io) {
      const sockets = await io.in(`user:${req.user.id}`).fetchSockets();
      for (const editorSocket of sockets) {
        if (editorSocket.data?.role !== 'editor' || Number(editorSocket.data?.channelId) !== channelId) continue;
        editorSocket.emit('access-revoked', { channelId, publicKey: channel.publicKey, reason: 'collaboration-left' });
        editorSocket.disconnect(true);
      }
    }

    logger.info('Colaborador abandonó un lienzo', { channelId, userId: req.user.id });
    res.status(204).end();
  }
  static async removeCollaborator(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    await models.ChannelCollaborator.destroy({ where: { channelId: req.channel.id, userId: Number(req.params.userId) } });
    res.status(204).end();
  }
}
