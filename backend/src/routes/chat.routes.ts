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

// GET /api/chat/stream?message=... — SSE streaming variant.
// Emits: `status` (accepted/processing heartbeats), then `result` or `error`.
// Kiro runs to completion server-side; heartbeats keep the connection alive
// through proxies and show a live "processing" state in the UI.
chatRouter.get('/stream', (req: Request, res: Response) => {
  const parsed = chatSchema.safeParse({ message: req.query.message });
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\n`);
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  if (!parsed.success) {
    send('error', { error: 'message is required (max 2000 chars)' });
    res.end();
    return;
  }

  send('status', { state: 'accepted' });
  // Heartbeat every 10s so proxies/clients keep the connection open.
  const heartbeat = setInterval(() => send('status', { state: 'processing' }), 10_000);

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearInterval(heartbeat);
    res.end();
  };
  req.on('close', finish);

  chatService
    .ask(parsed.data.message)
    .then((result) => {
      send('result', result);
      finish();
    })
    .catch((err) => {
      if (err instanceof ChatConfigError) send('error', { error: err.message });
      else send('error', { error: err instanceof Error ? err.message : 'chat failed' });
      finish();
    });
});

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
