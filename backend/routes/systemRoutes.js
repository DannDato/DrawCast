import { Router } from 'express';
import { asyncHandler } from '../middlewares/asyncHandler.js';
import { getSystemModuleStates } from '../services/moduleAccessService.js';

const router = Router();
router.get('/modules', asyncHandler(async (_req, res) => res.json({ modules: await getSystemModuleStates() })));
export default router;
