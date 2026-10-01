import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { StoreController } from '../../controllers/store/storeController.js';
import { StripeController } from '../../controllers/store/stripeController.js';
import { CartController } from '../../controllers/store/cartController.js';
import { storeSimulationEnabled } from '../../services/storeLicenseService.js';

const router = Router();
router.use(verifyToken);
router.get('/cart', authReadLimiter, asyncHandler(CartController.get));
router.post('/cart/items', mutationLimiter, asyncHandler(CartController.add));
router.patch('/cart/items/:productUuid', mutationLimiter, asyncHandler(CartController.update));
router.delete('/cart/items/:productUuid', mutationLimiter, asyncHandler(CartController.remove));
router.post('/cart/checkout', mutationLimiter, asyncHandler(CartController.checkout));
router.post('/orders/:orderUuid/checkout-session', mutationLimiter, asyncHandler(StripeController.checkoutSession));
router.get('/orders/:orderUuid/status', authReadLimiter, asyncHandler(StripeController.orderStatus));
router.get('/catalog', authReadLimiter, asyncHandler(StoreController.catalog));
router.get('/licenses', authReadLimiter, asyncHandler(StoreController.licenses));
if (storeSimulationEnabled()) {
  router.post('/orders/:orderUuid/dev/approve-payment', mutationLimiter, asyncHandler(StoreController.approveOrderPaymentDev));
  router.post('/dev/purchases', mutationLimiter, asyncHandler(StoreController.simulatePurchase));
}
router.post('/licenses/:licenseUuid/assign', mutationLimiter, asyncHandler(StoreController.assignLicense));
router.delete('/licenses/:licenseUuid/assignments/:assignmentUuid', mutationLimiter, asyncHandler(StoreController.releaseLicense));

export default router;
