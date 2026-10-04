import { Router } from 'express';
import { SystemAdminController } from '../../controllers/admin/systemAdminController.js';
import { verifyToken, requireSuperAdminPermissions } from '../../middlewares/auth.js';
import { authReadLimiter, mutationLimiter } from '../../middlewares/security.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = Router();
router.use(verifyToken);
router.use(requireSuperAdminPermissions('admin.system.access'));

router.get('/presence', authReadLimiter, asyncHandler(SystemAdminController.presence));
router.get('/catalog', authReadLimiter, requireSuperAdminPermissions('admin.catalog.read'), asyncHandler(SystemAdminController.catalog));
router.post('/catalog/products', mutationLimiter, requireSuperAdminPermissions('admin.catalog.manage'), asyncHandler(SystemAdminController.createCatalogProduct));
router.patch('/catalog/products/:productUuid', mutationLimiter, requireSuperAdminPermissions('admin.catalog.manage'), asyncHandler(SystemAdminController.updateCatalogProduct));
router.delete('/catalog/products/:productUuid', mutationLimiter, requireSuperAdminPermissions('admin.catalog.manage'), asyncHandler(SystemAdminController.disableCatalogProduct));
router.get('/modules', authReadLimiter, asyncHandler(SystemAdminController.modules));
router.patch('/modules/:moduleKey', mutationLimiter, requireSuperAdminPermissions('admin.modules.manage'), asyncHandler(SystemAdminController.updateModule));
router.get('/registration-invites', authReadLimiter, requireSuperAdminPermissions('admin.registration_invites.read'), asyncHandler(SystemAdminController.registrationInvites));
router.post('/registration-invites', mutationLimiter, requireSuperAdminPermissions('admin.registration_invites.manage'), asyncHandler(SystemAdminController.createRegistrationInvite));
router.delete('/registration-invites/:inviteUuid', mutationLimiter, requireSuperAdminPermissions('admin.registration_invites.manage'), asyncHandler(SystemAdminController.revokeRegistrationInvite));
router.get('/permissions', authReadLimiter, asyncHandler(SystemAdminController.permissions));
router.get('/users', authReadLimiter, requireSuperAdminPermissions('admin.users.read'), asyncHandler(SystemAdminController.users));
router.get('/collaborators', authReadLimiter, requireSuperAdminPermissions('admin.collaborators.read'), asyncHandler(SystemAdminController.collaborators));
router.post('/collaborators/:userUuid/license', mutationLimiter, requireSuperAdminPermissions('admin.collaborators.manage'), asyncHandler(SystemAdminController.grantCollabLicense));
router.delete('/collaborators/:userUuid/license', mutationLimiter, requireSuperAdminPermissions('admin.collaborators.manage'), asyncHandler(SystemAdminController.revokeCollabLicense));
router.patch('/users/:userUuid/permissions', mutationLimiter, requireSuperAdminPermissions('admin.users.permissions.manage'), asyncHandler(SystemAdminController.updateUserPermissions));

export default router;
