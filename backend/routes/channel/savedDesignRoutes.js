import { Router } from 'express';
import { SavedDesignController } from '../../controllers/channel/savedDesignController.js';
import { verifyToken } from '../../middlewares/auth.js';
import { requireChannelEditor } from '../../middlewares/channelAccess.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router({ mergeParams: true });
router.use(verifyToken);
router.use(asyncHandler(requireChannelEditor));
router.get('/', asyncHandler(SavedDesignController.list));
router.post('/', asyncHandler(SavedDesignController.create));
router.get('/:designId', asyncHandler(SavedDesignController.get));
router.patch('/:designId', asyncHandler(SavedDesignController.update));
router.delete('/:designId', asyncHandler(SavedDesignController.remove));
export default router;
