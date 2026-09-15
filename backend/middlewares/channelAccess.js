import { getEditableChannel } from '../services/channelAccessService.js';
export async function requireChannelEditor(req, res, next) {
  const channel = await getEditableChannel(req.user.id, Number(req.params.channelId));
  if (!channel) return res.status(403).json({ message: 'No tienes acceso de edición a este canal' });
  req.channel = channel; next();
}
