import { Router } from 'express';
import { SavedDesignController } from '../../controllers/channel/savedDesignController.js';
import { verifyToken } from '../../middlewares/auth.js';
import { requireChannelEditor } from '../../middlewares/channelAccess.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { mutationLimiter } from '../../middlewares/security.js';

const router = Router({ mergeParams: true });
router.use(verifyToken);
router.use(mutationLimiter);
router.use(asyncHandler(requireChannelEditor));
router.get('/', asyncHandler(SavedDesignController.list));
router.post('/', asyncHandler(SavedDesignController.create));
router.get('/:designUuid', asyncHandler(SavedDesignController.get));
router.patch('/:designUuid', asyncHandler(SavedDesignController.update));
router.delete('/:designUuid', asyncHandler(SavedDesignController.remove));
export default router;
