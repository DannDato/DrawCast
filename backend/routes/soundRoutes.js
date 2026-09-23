import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { authReadLimiter, publicMediaLimiter } from '../middlewares/security.js';
import { getSound, listSounds } from '../services/soundLibraryService.js';
import { getChannelSound } from '../services/channelSoundService.js';
import { models } from '../models/index.js';

const router = express.Router();

router.get('/', verifyToken, authReadLimiter, asyncHandler(async (_req, res) => {
  const sounds = await listSounds();
  return res.json({ sounds });
}));

router.get('/channel/:publicKey/:soundId', publicMediaLimiter, asyncHandler(async (req, res) => {
  const channel = await models.Channel.findOne({ where: { publicKey: String(req.params.publicKey || '') }, attributes: ['id'] });
  if (!channel) return res.status(404).json({ message: 'Sonido no encontrado' });
  const sound = await getChannelSound(channel.id, req.params.soundId);
  if (!sound) return res.status(404).json({ message: 'Sonido no encontrado' });

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', String(sound.size));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(sound.path);
}));

router.get('/:soundId', publicMediaLimiter, asyncHandler(async (req, res) => {
  const sound = await getSound(req.params.soundId);
  if (!sound) return res.status(404).json({ message: 'Sonido no encontrado' });

  res.setHeader('Content-Type', 'audio/mpeg');
  res.setHeader('Content-Length', String(sound.size));
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  return res.sendFile(sound.path);
}));

export default router;
