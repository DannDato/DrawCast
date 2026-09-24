import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { authReadLimiter } from '../../middlewares/security.js';
import { StoreController } from '../../controllers/store/storeController.js';

const router = Router();
router.use(verifyToken);
router.use(authReadLimiter);
router.get('/catalog', asyncHandler(StoreController.catalog));
router.get('/licenses', asyncHandler(StoreController.licenses));

export default router;
