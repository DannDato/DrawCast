import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { Router } from 'express';
import multer from 'multer';
import { verifyToken } from '../../middlewares/auth.js';
import { requireChannelEditor } from '../../middlewares/channelAccess.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { audit } from '../../helpers/audit.js';
import logger from '../../helpers/winston.js';
import { deleteChannelSound, getChannelSoundUploadLimits, ingestChannelSound, listChannelSounds } from '../../services/channelSoundService.js';
import { requireChannelFeature } from '../../middlewares/channelEntitlements.js';
import { getLimit, limitError } from '../../services/channelEntitlementAccessService.js';

const router = Router({ mergeParams: true });
const { sourceMaxBytes } = getChannelSoundUploadLimits();
const allowedMimeTypes = new Set(['audio/mpeg', 'audio/mp3', 'audio/x-mp3', 'application/octet-stream']);
const tempRoot = path.join(os.tmpdir(), 'trazio-sound-uploads');
fs.mkdirSync(tempRoot, { recursive: true });

function httpError(message, status = 400) {
  return Object.assign(new Error(message), { status });
}

const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) { callback(null, tempRoot); },
    filename(_req, _file, callback) { callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}.upload`); }
  }),
  limits: { fileSize: sourceMaxBytes, files: 1 },
  fileFilter(_req, file, callback) {
    const extensionOk = String(file.originalname || '').toLowerCase().endsWith('.mp3');
    if (!extensionOk || !allowedMimeTypes.has(String(file.mimetype || '').toLowerCase())) return callback(httpError('Sólo puedes subir archivos MP3.', 415));
    return callback(null, true);
  }
});

function uploadSound(req, res, next) {
  upload.single('sound')(req, res, (error) => {
    if (!error) return next();
    if (error?.code === 'LIMIT_FILE_SIZE') return next(httpError('El archivo es demasiado grande para procesarlo.', 413));
    return next(error);
  });
}

router.use(verifyToken);

router.get('/', authReadLimiter, asyncHandler(requireChannelEditor), asyncHandler(requireChannelFeature('editor.custom_sounds')), asyncHandler(async (req, res) => {
  const sounds = await listChannelSounds(req.channel.id);
  return res.json({ sounds, maxBytes: 2 * 1024 * 1024 });
}));

router.post('/', mutationLimiter, asyncHandler(requireChannelEditor), asyncHandler(requireChannelFeature('editor.custom_sounds')), asyncHandler(async (req, _res, next) => {
  const limit = getLimit(req.channelEntitlements, 'limit.custom_sound_slots');
  const sounds = await listChannelSounds(req.channel.id);
  if (sounds.length >= limit) throw limitError('limit.custom_sound_slots', limit, `Este lienzo ya usa sus ${limit} slot${limit === 1 ? '' : 's'} de sonidos personalizados.`);
  next();
}), uploadSound, asyncHandler(async (req, res) => {
  if (!req.file) throw httpError('No se recibió ningún MP3.');
  const sound = await ingestChannelSound({
    channelId: req.channel.id,
    userId: req.user.id,
    tempPath: req.file.path,
    originalName: req.file.originalname,
    size: req.file.size
  });
  await audit(req, { event: 'channel.sound_uploaded', category: 'channel', userId: req.user.id, metadata: { channelUuid: req.channel.uuid, soundId: sound.id, bytes: sound.size, compressed: sound.compressed } });
  logger.info('Sonido subido al lienzo', { channelId: req.channel.id, userId: req.user.id, soundId: sound.id, bytes: sound.size, compressed: sound.compressed });
  return res.status(201).json({ sound });
}));

router.delete('/:soundId', mutationLimiter, asyncHandler(requireChannelEditor), asyncHandler(requireChannelFeature('editor.custom_sounds')), asyncHandler(async (req, res) => {
  const deleted = await deleteChannelSound(req.channel.id, req.params.soundId);
  if (!deleted) return res.status(404).json({ message: 'Sonido no encontrado' });
  await audit(req, { event: 'channel.sound_deleted', category: 'channel', userId: req.user.id, metadata: { channelUuid: req.channel.uuid, soundId: req.params.soundId } });
  logger.info('Sonido eliminado del lienzo', { channelId: req.channel.id, userId: req.user.id, soundId: req.params.soundId });
  return res.json({ ok: true });
}));

export default router;
