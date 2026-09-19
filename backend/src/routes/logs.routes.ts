import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { logger } from '../logger';

export const logsRouter = Router();

// Logs require auth.
logsRouter.use(requireAuth);

const querySchema = z.object({
  limit: z.coerce.number().int().positive().max(500).optional(),
});

// GET /api/logs?limit=100 — recent application logs (secrets already scrubbed).
logsRouter.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const { limit } = querySchema.parse(req.query);
    const logs = await logger.recent(limit ?? 100);
    res.json(
      logs.map((l) => ({
        id: l.id,
        level: l.level,
        event: l.event,
        message: l.message,
        correlationId: l.correlationId,
        createdAt: l.createdAt.toISOString(),
      })),
    );
  }),
);
