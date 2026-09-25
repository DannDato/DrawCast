import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { StoreController } from '../../controllers/store/storeController.js';

const router = Router();
router.use(verifyToken);
router.get('/catalog', authReadLimiter, asyncHandler(StoreController.catalog));
router.get('/licenses', authReadLimiter, asyncHandler(StoreController.licenses));
router.post('/dev/purchases', mutationLimiter, asyncHandler(StoreController.simulatePurchase));
router.post('/licenses/:licenseUuid/assign', mutationLimiter, asyncHandler(StoreController.assignLicense));
router.delete('/licenses/:licenseUuid/assignments/:assignmentUuid', mutationLimiter, asyncHandler(StoreController.releaseLicense));

export default router;
