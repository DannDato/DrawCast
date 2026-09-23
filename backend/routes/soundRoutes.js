import express from 'express';
import { verifyToken } from '../middlewares/auth.js';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { authReadLimiter, publicMediaLimiter } from '../middlewares/security.js';
import { getSound, listSounds } from '../services/soundLibraryService.js';

const router = express.Router();

router.get('/', verifyToken, authReadLimiter, asyncHandler(async (_req, res) => {
  const sounds = await listSounds();
  return res.json({ sounds });
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
