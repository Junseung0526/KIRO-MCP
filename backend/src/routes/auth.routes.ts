import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';

export const authRouter = Router();

// Public auth endpoints (no auth required to bootstrap/login).
authRouter.get('/status', asyncHandler(authController.status));
authRouter.post('/setup', asyncHandler(authController.setup));
authRouter.post('/login', asyncHandler(authController.login));
authRouter.post('/logout', asyncHandler(authController.logout));

// Protected: only for authenticated sessions.
authRouter.get('/me', requireAuth, asyncHandler(authController.me));
