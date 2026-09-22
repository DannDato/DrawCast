import { getEditableChannel, isPublicUuid } from '../services/channelAccessService.js';

export async function requireChannelEditor(req, res, next) {
  const channelUuid = String(req.params.channelUuid || '').trim();
  if (!isPublicUuid(channelUuid)) return res.status(400).json({ message: 'Identificador de lienzo inválido' });
  const channel = await getEditableChannel(req.user.id, channelUuid);
  if (!channel) return res.status(403).json({ message: 'No tienes acceso de edición a este canal' });
  req.channel = channel;
  next();
}
