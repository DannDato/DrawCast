import express from 'express';
import authRoutes from './auth/authenticateRoutes.js';
import profileRoutes from './user/profileRoutes.js';
import settingsRoutes from './user/settingsRoutes.js';
import channelRoutes from './channel/channelRoutes.js';
import mediaRoutes from './channel/mediaRoutes.js';
import savedDesignRoutes from './channel/savedDesignRoutes.js';
import { getServerDiagnostics } from '../services/diagnosticsService.js';

const router = express.Router();

router.get('/health', (req, res) => res.json({ ok: true }));
router.get('/health/diagnostics', (req, res) => res.json(getServerDiagnostics()));
router.use('/auth', authRoutes);
router.use('/user', profileRoutes);
router.use('/user/settings', settingsRoutes);
router.use('/channels', channelRoutes);
router.use('/channels', mediaRoutes);
router.use('/channels/:channelId/designs', savedDesignRoutes);

export default router;
