import { Router, Request, Response } from 'express';
import { prisma } from '../prisma';
import { asyncHandler } from '../errors';

export const healthRouter = Router();

// Liveness + DB readiness. Used by the Docker healthcheck.
healthRouter.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    try {
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  }),
);
