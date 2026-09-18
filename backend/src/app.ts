import express, { Request, Response, NextFunction } from 'express';
import { prisma } from './prisma';
import { itemsRouter } from './items';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Minimal permissive CORS so the browser frontend (different origin/port)
  // can call the API. Kept dependency-free on purpose.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(204);
    }
    next();
  });

  // Liveness + DB readiness. Used by the Docker healthcheck.
  app.get('/health', async (_req: Request, res: Response) => {
    try {
      // Verifies the DB connection is actually usable.
      await prisma.$queryRaw`SELECT 1`;
      res.status(200).json({ status: 'ok', database: 'up' });
    } catch {
      res.status(503).json({ status: 'error', database: 'down' });
    }
  });

  app.use('/api/items', itemsRouter);

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' });
  });

  // Central error handler (never leak internals / secrets)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('[error]', err instanceof Error ? err.message : 'unknown error');
    res.status(500).json({ error: 'internal server error' });
  });

  return app;
}
