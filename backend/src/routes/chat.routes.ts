import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { chatService, ChatConfigError } from '../services/chat.service';

export const chatRouter = Router();

// Chat requires an authenticated session.
chatRouter.use(requireAuth);

const chatSchema = z.object({
  message: z.string().trim().min(1, 'message is required').max(2000, 'message too long'),
});

// GET /api/chat/status — is chat configured (bridge reachable config present)?
chatRouter.get(
  '/status',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({ configured: chatService.isConfigured() });
  }),
);

// POST /api/chat — natural language -> Kiro CLI -> MCP tools -> DB -> reply.
chatRouter.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { message } = chatSchema.parse(req.body ?? {});
    try {
      const result = await chatService.ask(message);
      res.json(result);
    } catch (err) {
      if (err instanceof ChatConfigError) {
        res.status(503).json({ error: err.message });
        return;
      }
      throw err;
    }
  }),
);
