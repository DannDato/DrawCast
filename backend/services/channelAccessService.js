import { models } from '../models/index.js';

export async function getEditableChannel(userId, channelId) {
  const channel = await models.Channel.findByPk(channelId);
  if (!channel) return null;
  if (Number(channel.ownerId) === Number(userId)) return channel;
  const link = await models.ChannelCollaborator.findOne({ where: { channelId, userId, canEdit: true } });
  return link ? channel : null;
}

export async function getEditableChannelByPublicKey(userId, publicKey) {
  const channel = await models.Channel.findOne({ where: { publicKey } });
  return channel ? getEditableChannel(userId, channel.id) : null;
}
