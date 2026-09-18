import express from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { ctrlSettings } from '../../controllers/user/settingsController.js';

const r = express.Router();

r.get('/', verifyToken, asyncHandler(ctrlSettings.get));
r.patch('/editor', verifyToken, asyncHandler(ctrlSettings.updateEditor));
r.delete('/editor', verifyToken, asyncHandler(ctrlSettings.resetEditor));

export default r;
