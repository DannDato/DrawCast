import express from 'express';
import authRoutes from './auth/authenticateRoutes.js';
import profileRoutes from './user/profileRoutes.js';
import channelRoutes from './channel/channelRoutes.js';
import mediaRoutes from './channel/mediaRoutes.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));
router.use('/auth', authRoutes);
router.use('/user', profileRoutes);
router.use('/channels', channelRoutes);
router.use('/channels', mediaRoutes);

export default router;
