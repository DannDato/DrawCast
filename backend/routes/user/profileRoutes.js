import express from 'express';
import { verifyToken } from '../../middlewares/auth.js';
import { ctrlProfile } from '../../controllers/user/profileController.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const r = express.Router();

r.get('/profile', verifyToken, asyncHandler(ctrlProfile.get));
r.patch('/profile', verifyToken, asyncHandler(ctrlProfile.update));
r.patch('/profile/password', verifyToken, asyncHandler(ctrlProfile.changePassword));
r.post('/profile/email/request', verifyToken, asyncHandler(ctrlProfile.requestEmailChange));
r.post('/profile/email/confirm', verifyToken, asyncHandler(ctrlProfile.confirmEmailChange));
r.post('/profile/google/connect', verifyToken, asyncHandler(ctrlProfile.connectGoogle));
r.delete('/profile/google', verifyToken, asyncHandler(ctrlProfile.disconnectGoogle));
r.put('/profile/avatar', verifyToken, express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), asyncHandler(ctrlProfile.uploadAvatar));
r.delete('/profile/avatar', verifyToken, asyncHandler(ctrlProfile.deleteAvatar));
r.get('/profile/sessions', verifyToken, asyncHandler(ctrlProfile.sessions));
r.delete('/profile/sessions/others', verifyToken, asyncHandler(ctrlProfile.revokeOtherSessions));
r.delete('/profile/sessions', verifyToken, asyncHandler(ctrlProfile.revokeAllSessions));
r.delete('/profile/sessions/:id', verifyToken, asyncHandler(ctrlProfile.revokeSession));

export default r;
