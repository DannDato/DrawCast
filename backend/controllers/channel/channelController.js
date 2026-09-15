import crypto from 'node:crypto';
import { models } from '../../models/index.js';
import { createInvitation, acceptInvitation } from '../../services/channelInvitationService.js';
import logger from '../../helpers/winston.js';

export class ChannelController {
  static async mine(req, res) {
    const owned = await models.Channel.findOne({ where: { ownerId: req.user.id } });
    const collaborations = await models.ChannelCollaborator.findAll({ where: { userId: req.user.id, canEdit: true }, include: [{ model: models.Channel, as: 'channel' }] });
    res.json({ owned, collaborations: collaborations.map((row) => row.channel) });
  }
  static async create(req, res) {
    const existing = await models.Channel.findOne({ where: { ownerId: req.user.id } });
    if (existing) return res.status(409).json({ message: 'Ya tienes un canal', channel: existing });
    const name = String(req.body.name || '').trim(); if (!name) return res.status(400).json({ message: 'Nombre del canal requerido' });
    const channel = await models.Channel.create({ ownerId: req.user.id, name, platform: req.body.platform || null, channelUrl: req.body.channelUrl || null, publicKey: crypto.randomBytes(24).toString('hex') });
    logger.info('Canal creado', { channelId: channel.id, ownerId: req.user.id }); res.status(201).json(channel);
  }
  static async update(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede cambiar estos datos' });
    await req.channel.update({ name: String(req.body.name || req.channel.name).trim(), platform: req.body.platform ?? req.channel.platform, channelUrl: req.body.channelUrl ?? req.channel.channelUrl }); res.json(req.channel);
  }
  static async invite(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede invitar colaboradores' });
    const invitation = await createInvitation(req.channel, req.user, req.body.email); res.status(201).json({ id: invitation.id, email: invitation.email, expiresAt: invitation.expiresAt });
  }
  static async accept(req, res) { const invitation = await acceptInvitation(req.body.token, req.user); res.json({ message: 'Invitación aceptada', channelId: invitation.channelId }); }
  static async collaborators(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    const rows = await models.ChannelCollaborator.findAll({ where: { channelId: req.channel.id }, include: [{ model: models.User, as: 'user', attributes: ['id','username','email','displayName','avatarUrl'] }] }); res.json(rows);
  }
  static async removeCollaborator(req, res) {
    if (Number(req.channel.ownerId) !== Number(req.user.id)) return res.status(403).json({ message: 'Sólo el propietario puede administrar colaboradores' });
    await models.ChannelCollaborator.destroy({ where: { channelId: req.channel.id, userId: Number(req.params.userId) } }); res.status(204).end();
  }
}
