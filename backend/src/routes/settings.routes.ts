import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { authService } from '../services/auth.service';
import { logger } from '../logger';

export const settingsRouter = Router();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'new password must be at least 8 characters'),
});

// All settings endpoints require auth.
settingsRouter.use(requireAuth);

// POST /api/settings/password — change password.
settingsRouter.post(
  '/password',
  asyncHandler(async (req: Request, res: Response) => {
    const { currentPassword, newPassword } = changePasswordSchema.parse(req.body ?? {});
    await authService.changePassword(currentPassword, newPassword);
    await logger.info('settings.password.changed', 'password changed');
    res.json({ ok: true });
  }),
);
