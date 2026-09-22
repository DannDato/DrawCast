import { Router } from 'express';
import path from 'node:path';
import { models } from '../../models/index.js';
import { isPublicUuid } from '../../services/channelAccessService.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
const root = path.resolve(process.cwd(), process.env.UPLOAD_DIR || 'uploads', 'channels');
const filePattern = /^\d{10,}-[0-9a-f]{16}\.(?:png|jpe?g|webp|gif)$/i;

router.get('/:channelUuid/:fileName', asyncHandler(async (req, res) => {
  const channelUuid = String(req.params.channelUuid || '').trim();
  const fileName = String(req.params.fileName || '').trim();
  if (!filePattern.test(fileName) || path.basename(fileName) !== fileName) return res.status(404).end();

  if (!isPublicUuid(channelUuid)) return res.status(404).end();
  const channel = await models.Channel.findOne({ where: { uuid: channelUuid }, attributes: ['id'] });
  if (!channel) return res.status(404).end();

  res.set('Cache-Control', 'public, max-age=3600');
  return res.sendFile(fileName, { root: path.join(root, String(channel.id)), dotfiles: 'deny' });
}));

export default router;
