import { models } from '../models/index.js';

export function isPublicUuid(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || '').trim());
}

export async function getEditableChannel(userId, channelUuid) {
  if (!isPublicUuid(channelUuid)) return null;
  const channel = await models.Channel.findOne({ where: { uuid: channelUuid } });
  if (!channel) return null;
  if (Number(channel.ownerId) === Number(userId)) return channel;
  const link = await models.ChannelCollaborator.findOne({ where: { channelId: channel.id, userId, canEdit: true } });
  return link ? channel : null;
}

export async function getEditableChannelByPublicKey(userId, publicKey) {
  const channel = await models.Channel.findOne({ where: { publicKey } });
  return channel ? getEditableChannel(userId, channel.uuid) : null;
}
