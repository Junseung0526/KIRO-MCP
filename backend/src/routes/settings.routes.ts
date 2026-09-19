import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { authService } from '../services/auth.service';
import { logger } from '../logger';
import { notionService } from '../notion/notion.service';
import { NotionError } from '../notion/notion.types';

export const settingsRouter = Router();

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8, 'new password must be at least 8 characters'),
});

const notionSaveSchema = z.object({
  token: z.string().min(10, 'invalid token'),
  databaseId: z.string().min(20, 'invalid database id'),
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

// ---- Notion integration settings ----

// GET /api/settings/notion — status only. NEVER returns the token.
settingsRouter.get(
  '/notion',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json(await notionService.status());
  }),
);

// POST /api/settings/notion/test — test a candidate token+db WITHOUT saving.
settingsRouter.post(
  '/notion/test',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, databaseId } = notionSaveSchema.parse(req.body ?? {});
    try {
      await notionService.test(token, databaseId);
      res.json({ ok: true, message: 'Notion Database 연결에 성공했습니다.' });
    } catch (err) {
      const message =
        err instanceof NotionError
          ? 'Notion Database에 연결할 수 없습니다. Token과 Database 권한 및 Database ID를 확인해주세요.'
          : 'Notion Database에 연결할 수 없습니다.';
      res.status(400).json({ ok: false, message });
    }
  }),
);

// POST /api/settings/notion — test then save (encrypted). Never echoes token.
settingsRouter.post(
  '/notion',
  asyncHandler(async (req: Request, res: Response) => {
    const { token, databaseId } = notionSaveSchema.parse(req.body ?? {});
    try {
      await notionService.save(token, databaseId);
    } catch (err) {
      const message =
        err instanceof NotionError
          ? 'Notion Database에 연결할 수 없습니다. Token과 Database 권한 및 Database ID를 확인해주세요.'
          : 'Notion 저장에 실패했습니다.';
      res.status(400).json({ ok: false, message });
      return;
    }
    res.status(201).json(await notionService.status());
  }),
);

// DELETE /api/settings/notion — disconnect (delete stored credential).
settingsRouter.delete(
  '/notion',
  asyncHandler(async (_req: Request, res: Response) => {
    await notionService.remove();
    res.json({ ok: true });
  }),
);
