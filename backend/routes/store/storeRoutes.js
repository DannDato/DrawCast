import { Router } from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { StoreController } from '../../controllers/store/storeController.js';
import { StripeController } from '../../controllers/store/stripeController.js';
import { CartController } from '../../controllers/store/cartController.js';
import { storeSimulationEnabled } from '../../services/storeLicenseService.js';
import { requireModuleEnabled } from '../../middlewares/moduleAccess.js';

const router = Router();
router.use(verifyToken);
router.get('/cart', requireModuleEnabled('store'), authReadLimiter, asyncHandler(CartController.get));
router.post('/cart/items', requireModuleEnabled('store'), mutationLimiter, asyncHandler(CartController.add));
router.patch('/cart/items/:productUuid', requireModuleEnabled('store'), mutationLimiter, asyncHandler(CartController.update));
router.delete('/cart/items/:productUuid', requireModuleEnabled('store'), mutationLimiter, asyncHandler(CartController.remove));
router.post('/cart/checkout', requireModuleEnabled('store'), mutationLimiter, asyncHandler(CartController.checkout));
router.post('/orders/:orderUuid/checkout-session', requireModuleEnabled('store'), mutationLimiter, asyncHandler(StripeController.checkoutSession));
router.get('/orders/:orderUuid/status', requireModuleEnabled('store'), authReadLimiter, asyncHandler(StripeController.orderStatus));
router.get('/catalog', requireModuleEnabled('store'), authReadLimiter, asyncHandler(StoreController.catalog));
router.get('/licenses', authReadLimiter, asyncHandler(StoreController.licenses));
if (storeSimulationEnabled()) {
  router.post('/orders/:orderUuid/dev/approve-payment', requireModuleEnabled('store'), mutationLimiter, asyncHandler(StoreController.approveOrderPaymentDev));
  router.post('/dev/purchases', requireModuleEnabled('store'), mutationLimiter, asyncHandler(StoreController.simulatePurchase));
}
router.post('/licenses/:licenseUuid/assign', mutationLimiter, asyncHandler(StoreController.assignLicense));
router.delete('/licenses/:licenseUuid/assignments/:assignmentUuid', mutationLimiter, asyncHandler(StoreController.releaseLicense));

export default router;
