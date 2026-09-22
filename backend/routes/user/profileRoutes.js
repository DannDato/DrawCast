import express from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { ctrlProfile } from '../../controllers/user/profileController.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';
import { sensitiveAccountLimiter } from '../../middlewares/security.js';

const r = express.Router();

r.get('/profile', verifyToken, asyncHandler(ctrlProfile.get));
r.patch('/profile', verifyToken, asyncHandler(ctrlProfile.update));
r.patch('/profile/password', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.changePassword));
r.post('/profile/email/request', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.requestEmailChange));
r.post('/profile/email/confirm', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.confirmEmailChange));
r.post('/profile/google/connect', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.connectGoogle));
r.post('/profile/google/connect/code', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.connectGoogleCode));
r.delete('/profile/oauth/:provider', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.disconnectOAuth));
r.put('/profile/avatar', verifyToken, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), asyncHandler(ctrlProfile.uploadAvatar));
r.delete('/profile/avatar', verifyToken, asyncHandler(ctrlProfile.deleteAvatar));
r.get('/profile/sessions', verifyToken, asyncHandler(ctrlProfile.sessions));
r.delete('/profile/sessions/others', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.revokeOtherSessions));
r.delete('/profile/sessions', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.revokeAllSessions));
r.delete('/profile/sessions/:id', verifyToken, sensitiveAccountLimiter, asyncHandler(ctrlProfile.revokeSession));

export default r;
