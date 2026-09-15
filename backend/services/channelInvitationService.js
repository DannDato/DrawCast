import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { sha256 } from '../helpers/security.js';
import logger from '../helpers/winston.js';
import * as emailService from './emailService.js';

export async function createInvitation(channel, inviter, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw Object.assign(new Error('Correo requerido'), { status: 400 });

  const invitedUser = await models.User.findOne({ where: { email: normalized }, attributes: ['id', 'email', 'username', 'displayName'] });
  if (!invitedUser) {
    logger.warn('Invitación rechazada: correo sin cuenta', { channelId: channel.id, invitedBy: inviter.id, email: normalized });
    throw Object.assign(new Error('Ese correo todavía no tiene una cuenta en DrawCast'), { status: 404 });
  }
  if (Number(invitedUser.id) === Number(inviter.id)) throw Object.assign(new Error('No puedes invitarte a tu propio canal'), { status: 400 });

  const existingCollaborator = await models.ChannelCollaborator.findOne({ where: { channelId: channel.id, userId: invitedUser.id, canEdit: true } });
  if (existingCollaborator) throw Object.assign(new Error('Ese usuario ya tiene acceso al canal'), { status: 409 });

  await models.ChannelInvitation.update({ revokedAt: new Date() }, { where: { channelId: channel.id, email: normalized, acceptedAt: null, revokedAt: null } });
  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await models.ChannelInvitation.create({ channelId: channel.id, invitedBy: inviter.id, email: normalized, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86400000) });
  await emailService.sendChannelInvitation(normalized, token, channel.name, inviter.displayName || inviter.username);
  logger.info('Invitación de canal enviada a usuario registrado', { channelId: channel.id, invitationId: invitation.id, invitedBy: inviter.id, invitedUserId: invitedUser.id });
  return invitation;
}

export async function acceptInvitation(token, user) {
  const invitation = await models.ChannelInvitation.findOne({ where: { tokenHash: sha256(token), acceptedAt: null, revokedAt: null, expiresAt: { [Op.gt]: new Date() } } });
  if (!invitation) throw Object.assign(new Error('Invitación inválida o expirada'), { status: 400 });
  if (user.email.toLowerCase() !== invitation.email.toLowerCase()) throw Object.assign(new Error('La invitación pertenece a otro correo'), { status: 403 });
  await models.ChannelCollaborator.findOrCreate({ where: { channelId: invitation.channelId, userId: user.id }, defaults: { invitedBy: invitation.invitedBy, canEdit: true } });
  await invitation.update({ acceptedAt: new Date() });
  logger.info('Invitación de canal aceptada', { channelId: invitation.channelId, userId: user.id, invitationId: invitation.id });
  return invitation;
}
