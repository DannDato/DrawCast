import { Router } from 'express';
import { db, models } from '../../models/index.js';
import { verifyToken } from '../../middlewares/auth.js';
import { requireChannelEditor } from '../../middlewares/channelAccess.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { parseGuideSlot, validateGuide } from '../../services/channelGuideService.js';
import { requireChannelFeature } from '../../middlewares/channelEntitlements.js';
import { getLimit, limitError } from '../../services/channelEntitlementAccessService.js';

const router = Router({ mergeParams: true });
router.use(verifyToken, asyncHandler(requireChannelEditor), asyncHandler(requireChannelFeature('editor.guides')));

const publicGuide = (row) => ({ slot: row.slot, name: `Guía ${row.slot}`, sizeBytes: row.sizeBytes, updatedAt: row.updatedAt });
const notifyGuides = (req) => req.app.get('io')?.to(`channel:${req.channel.id}:editors`).emit('guides-changed');

router.get('/', authReadLimiter, asyncHandler(async (req, res) => {
  const guides = await models.ChannelGuide.findAll({ where: { channelId: req.channel.id }, attributes: { exclude: ['imageData'] }, order: [['slot', 'ASC']] });
  res.json(guides.map(publicGuide));
}));

router.param('slot', (req, res, next, value) => {
  req.guideSlot = parseGuideSlot(value);
  if (!req.guideSlot) return res.status(400).json({ message: 'El espacio de guía no es válido.' });
  next();
});


function requireGuideSlot(req, _res, next) {
  const limit = getLimit(req.channelEntitlements, 'limit.guide_slots');
  if (req.guideSlot > limit) throw limitError('limit.guide_slots', limit, `Este lienzo tiene ${limit} slot${limit === 1 ? '' : 's'} de guía disponible${limit === 1 ? '' : 's'}.`);
  next();
}

router.get('/:slot', authReadLimiter, requireGuideSlot, asyncHandler(async (req, res) => {
  const guide = await models.ChannelGuide.findOne({ where: { channelId: req.channel.id, slot: req.guideSlot } });
  if (!guide) return res.status(404).json({ message: 'Guía no encontrada.' });
  res.set('Cache-Control', 'no-store').json({ ...publicGuide(guide), imageData: guide.imageData });
}));

router.put('/:slot', mutationLimiter, requireGuideSlot, asyncHandler(async (req, res) => {
  const data = validateGuide(req.body, req.guideSlot);
  const guide = await db.transaction(async (transaction) => {
    await models.Channel.findByPk(req.channel.id, { transaction, lock: transaction.LOCK.UPDATE });
    const where = { channelId: req.channel.id, slot: req.guideSlot };
    const current = await models.ChannelGuide.findOne({ where, transaction });
    return current ? current.update(data, { transaction }) : models.ChannelGuide.create({ ...where, ...data }, { transaction });
  });
  notifyGuides(req);
  res.json(publicGuide(guide));
}));

router.delete('/:slot', mutationLimiter, asyncHandler(async (req, res) => {
  await models.ChannelGuide.destroy({ where: { channelId: req.channel.id, slot: req.guideSlot } });
  notifyGuides(req);
  res.status(204).end();
}));

export default router;
