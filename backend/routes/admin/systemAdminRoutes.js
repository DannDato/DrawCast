import { Router } from 'express';
import { SystemAdminController } from '../../controllers/admin/systemAdminController.js';
import { verifyToken, requireSuperAdminPermissions } from '../../middlewares/auth.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
router.use(verifyToken);
router.use(requireSuperAdminPermissions('admin.system.access'));

router.get('/permissions', authReadLimiter, asyncHandler(SystemAdminController.permissions));
router.get('/users', authReadLimiter, requireSuperAdminPermissions('admin.users.read'), asyncHandler(SystemAdminController.users));
router.get('/collaborators', authReadLimiter, requireSuperAdminPermissions('admin.collaborators.read'), asyncHandler(SystemAdminController.collaborators));
router.post('/collaborators/:userUuid/license', mutationLimiter, requireSuperAdminPermissions('admin.collaborators.manage'), asyncHandler(SystemAdminController.grantCollabLicense));
router.delete('/collaborators/:userUuid/license', mutationLimiter, requireSuperAdminPermissions('admin.collaborators.manage'), asyncHandler(SystemAdminController.revokeCollabLicense));
router.patch('/users/:userUuid/permissions', mutationLimiter, requireSuperAdminPermissions('admin.users.permissions.manage'), asyncHandler(SystemAdminController.updateUserPermissions));

export default router;
