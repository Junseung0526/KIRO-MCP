import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { errorHandler } from './errors';
import { healthRouter } from './routes/health.routes';
import { itemRouter } from './routes/item.routes';
import { authRouter } from './routes/auth.routes';
import { chatRouter } from './routes/chat.routes';
import { logsRouter } from './routes/logs.routes';
import { settingsRouter } from './routes/settings.routes';
import { notionRouter } from './routes/notion.routes';
import { documentRouter } from './routes/document.routes';

export function createApp() {
  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  // The app is served same-origin behind nginx, so CORS is generally not needed.
  // Kept minimal + credentials-aware in case of same-site subpaths.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header('Access-Control-Allow-Origin', origin);
      res.header('Access-Control-Allow-Credentials', 'true');
    }
    res.header('Access-Control-Allow-Methods', 'GET,POST,PATCH,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  // Public: health (no auth).
  app.use('/health', healthRouter);
  // Public: auth bootstrap/login (individual endpoints guard themselves).
  app.use('/api/auth', authRouter);

  // Protected routers (each applies requireAuth internally).
  app.use('/api/items', itemRouter);
  app.use('/api/chat', chatRouter);
  app.use('/api/logs', logsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/notion', notionRouter);
  app.use('/api/documents', documentRouter);

  // 404 fallback
  app.use((_req: Request, res: Response) => {
    res.status(404).json({ error: 'not found' });
  });

  // Central error handler (never leak internals / secrets)
  app.use(errorHandler);

  return app;
}
