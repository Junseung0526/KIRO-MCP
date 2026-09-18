import express, { Request, Response, NextFunction } from 'express';
import { errorHandler } from './errors';
import { healthRouter } from './routes/health.routes';
import { itemRouter } from './routes/item.routes';

export function createApp() {
  const app = express();

  app.use(express.json());

  // Minimal dependency-free CORS so the browser frontend (different origin/port)
  // can call the API.
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use('/health', healthRouter);
  app.use('/api/items', itemRouter);

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' });
  });

  // Central error handler (never leak internals / secrets)
  app.use(errorHandler);

  return app;
}
