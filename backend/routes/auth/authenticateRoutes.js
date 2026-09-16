import express from 'express';
import { ctrlAuth } from '../../controllers/auth/authController.js';
import { verifyToken } from '../../middlewares/auth.js';
import { authLimiter, otpLimiter, otpResendLimiter } from '../../middlewares/security.js';
import { asyncHandler } from '../../middlewares/asyncHandler.js';

const router = express.Router();
router.post('/login', authLimiter, asyncHandler(ctrlAuth.login));
router.post('/register', authLimiter, asyncHandler(ctrlAuth.register));
router.post('/verify-access', otpLimiter, asyncHandler(ctrlAuth.verifyAccess));
router.post('/resend-access-code', otpResendLimiter, asyncHandler(ctrlAuth.resendAccessCode));
router.get('/me', verifyToken, asyncHandler(ctrlAuth.me));
router.post('/logout', verifyToken, asyncHandler(ctrlAuth.logout));
router.get('/google/config', asyncHandler(ctrlAuth.googleConfig));
router.post('/google', authLimiter, asyncHandler(ctrlAuth.googleAuth));
router.get('/twitch/config', asyncHandler(ctrlAuth.twitchConfig));
router.get('/twitch', authLimiter, asyncHandler(ctrlAuth.twitchStart));
router.get('/twitch/callback', authLimiter, asyncHandler(ctrlAuth.twitchCallback));
router.post('/forgot-password', authLimiter, asyncHandler(ctrlAuth.forgotPassword));
router.post('/reset-password', authLimiter, asyncHandler(ctrlAuth.resetPassword));

export default router;
