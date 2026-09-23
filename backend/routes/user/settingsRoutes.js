import express from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { mutationLimiter } from '../../middlewares/security.js';
import { ctrlSettings } from '../../controllers/user/settingsController.js';

const r = express.Router();

r.use(verifyToken);
r.use(mutationLimiter);
r.get('/', asyncHandler(ctrlSettings.get));
r.patch('/editor', asyncHandler(ctrlSettings.updateEditor));
r.patch('/sounds', asyncHandler(ctrlSettings.updateSoundSlots));
r.patch('/launchpad', asyncHandler(ctrlSettings.updateLaunchpadSlots));
r.delete('/editor', asyncHandler(ctrlSettings.resetEditor));

export default r;
