import crypto from 'node:crypto';
import { Op } from 'sequelize';
import { models } from '../models/index.js';
import { sha256 } from '../helpers/security.js';
import logger from '../helpers/winston.js';
import * as emailService from './emailService.js';

const invitationInclude = [
  { model: models.Channel, as: 'channel', attributes: ['id', 'name', 'platform', 'channelUrl', 'publicKey', 'ownerId'] },
  { model: models.User, as: 'inviter', attributes: ['id', 'username', 'displayName', 'avatarUrl'] }
];

function invitationMessage(status) {
  if (status === 'already_member_suspended') return 'Ya formas parte de este equipo, pero tu acceso está suspendido.';
  if (status === 'already_member') return 'Ya formas parte de este equipo.';
  if (status === 'accepted') return 'Invitación aceptada.';
  return 'Invitación procesada.';
}

async function findMembership(invitation, user) {
  return models.ChannelCollaborator.findOne({ where: { channelId: invitation.channelId, userId: user.id } });
}

async function acceptInvitationRecord(invitation, user) {
  if (String(user.email || '').toLowerCase() !== String(invitation.email || '').toLowerCase()) {
    throw Object.assign(new Error('La invitación pertenece a otro correo'), { status: 403 });
  }

  const collaborator = await findMembership(invitation, user);

  if (collaborator) {
    if (!invitation.acceptedAt) await invitation.update({ acceptedAt: new Date() });
    const status = collaborator.canEdit === false ? 'already_member_suspended' : 'already_member';
    return { invitation, collaborator, status, message: invitationMessage(status) };
  }
  if (invitation.acceptedAt) {
    throw Object.assign(new Error('Esta invitación ya fue utilizada. Si quieres volver a este equipo, pide una nueva invitación.'), { status: 410, code: 'INVITATION_ALREADY_USED' });
  }

  if (invitation.revokedAt) throw Object.assign(new Error('Esta invitación ya no está disponible.'), { status: 410, code: 'INVITATION_REVOKED' });
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) throw Object.assign(new Error('Esta invitación ya expiró.'), { status: 410, code: 'INVITATION_EXPIRED' });

  const [createdCollaborator] = await models.ChannelCollaborator.findOrCreate({
    where: { channelId: invitation.channelId, userId: user.id },
    defaults: { invitedBy: invitation.invitedBy, canEdit: true }
  });

  await invitation.update({ acceptedAt: new Date() });
  logger.info('Invitación de canal aceptada', { channelId: invitation.channelId, userId: user.id, invitationId: invitation.id });
  return { invitation, collaborator: createdCollaborator, status: 'accepted', message: invitationMessage('accepted') };
}

export async function createInvitation(channel, inviter, email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) throw Object.assign(new Error('Correo requerido'), { status: 400 });

  const invitedUser = await models.User.findOne({ where: { email: normalized }, attributes: ['id', 'email', 'username', 'displayName'] });
  if (!invitedUser) {
    logger.warn('Invitación rechazada: correo sin cuenta', { channelId: channel.id, invitedBy: inviter.id, email: normalized });
    throw Object.assign(new Error('Ese correo todavía no tiene una cuenta en DrawCast'), { status: 404 });
  }
  if (Number(invitedUser.id) === Number(inviter.id)) throw Object.assign(new Error('No puedes invitarte a tu propio canal'), { status: 400 });

  const existingCollaborator = await models.ChannelCollaborator.findOne({ where: { channelId: channel.id, userId: invitedUser.id } });
  if (existingCollaborator?.canEdit) throw Object.assign(new Error('Ese usuario ya tiene acceso al lienzo'), { status: 409 });
  if (existingCollaborator && !existingCollaborator.canEdit) throw Object.assign(new Error('Ese usuario ya está agregado, pero está suspendido. Reactívalo desde la lista de colaboradores.'), { status: 409 });

  await models.ChannelInvitation.update({ revokedAt: new Date() }, { where: { channelId: channel.id, email: normalized, acceptedAt: null, revokedAt: null } });
  const token = crypto.randomBytes(32).toString('hex');
  const invitation = await models.ChannelInvitation.create({ channelId: channel.id, invitedBy: inviter.id, email: normalized, tokenHash: sha256(token), expiresAt: new Date(Date.now() + 7 * 86400000) });
  await emailService.sendChannelInvitation(normalized, token, channel.name, inviter.displayName || inviter.username);
  logger.info('Invitación de canal enviada a usuario registrado', { channelId: channel.id, invitationId: invitation.id, invitedBy: inviter.id, invitedUserId: invitedUser.id });
  return invitation;
}

export async function listPendingInvitations(user) {
  const email = String(user.email || '').trim().toLowerCase();
  if (!email) return [];

  const invitations = await models.ChannelInvitation.findAll({
    where: { email, acceptedAt: null, revokedAt: null, expiresAt: { [Op.gt]: new Date() } },
    include: invitationInclude,
    order: [['createdAt', 'DESC']]
  });

  if (!invitations.length) return [];

  const channelIds = invitations.map((row) => row.channelId);
  const memberships = await models.ChannelCollaborator.findAll({ where: { userId: user.id, channelId: { [Op.in]: channelIds } } });
  const membershipByChannel = new Map(memberships.map((row) => [Number(row.channelId), row]));
  const stale = invitations.filter((row) => membershipByChannel.has(Number(row.channelId)));
  if (stale.length) {
    await models.ChannelInvitation.update(
      { acceptedAt: new Date() },
      { where: { id: { [Op.in]: stale.map((row) => row.id) } } }
    );
  }

  return invitations.filter((row) => !membershipByChannel.has(Number(row.channelId)));
}

export async function acceptInvitation(token, user) {
  const invitation = await models.ChannelInvitation.findOne({ where: { tokenHash: sha256(token) }, include: invitationInclude });
  if (!invitation) throw Object.assign(new Error('Invitación inválida.'), { status: 404, code: 'INVITATION_NOT_FOUND' });
  return acceptInvitationRecord(invitation, user);
}

export async function acceptInvitationById(invitationId, user) {
  const invitation = await models.ChannelInvitation.findByPk(invitationId, { include: invitationInclude });
  if (!invitation) throw Object.assign(new Error('Invitación no encontrada.'), { status: 404, code: 'INVITATION_NOT_FOUND' });
  return acceptInvitationRecord(invitation, user);
}

export async function rejectInvitationById(invitationId, user) {
  const invitation = await models.ChannelInvitation.findByPk(invitationId, { include: invitationInclude });
  if (!invitation) throw Object.assign(new Error('Invitación no encontrada.'), { status: 404, code: 'INVITATION_NOT_FOUND' });
  if (String(user.email || '').toLowerCase() !== String(invitation.email || '').toLowerCase()) {
    throw Object.assign(new Error('La invitación pertenece a otro correo'), { status: 403 });
  }

  const collaborator = await findMembership(invitation, user);
  if (collaborator) {
    const status = collaborator.canEdit === false ? 'already_member_suspended' : 'already_member';
    return { invitation, status, message: invitationMessage(status) };
  }
  if (invitation.acceptedAt) return { invitation, status: 'already_used', message: 'Esta invitación ya fue utilizada.' };
  if (invitation.revokedAt) return { invitation, status: 'already_rejected', message: 'Esta invitación ya no está disponible.' };
  if (new Date(invitation.expiresAt).getTime() <= Date.now()) return { invitation, status: 'expired', message: 'Esta invitación ya expiró.' };

  await invitation.update({ revokedAt: new Date() });
  logger.info('Invitación de canal rechazada', { channelId: invitation.channelId, userId: user.id, invitationId: invitation.id });
  return { invitation, status: 'rejected', message: 'Invitación rechazada.' };
}
