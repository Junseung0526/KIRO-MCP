// requireAuth middleware: allows the request when EITHER
//  (a) a valid session JWT is present in the httpOnly cookie (browser user), OR
//  (b) a valid internal service token is present (X-Internal-Token) — used by
//      the MCP server (internal network only) to call the item API on behalf of
//      Kiro-driven tool calls.
// Protects CRUD, chat, logs, and settings APIs. /health stays public.
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { authService } from '../services/auth.service';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  // (b) internal service token (constant-time-ish compare via length + value).
  const internal = req.header('x-internal-token');
  if (
    config.internalApiToken &&
    typeof internal === 'string' &&
    internal.length === config.internalApiToken.length &&
    internal === config.internalApiToken
  ) {
    next();
    return;
  }

  // (a) browser session cookie.
  const token = (req.cookies?.[config.cookieName] as string | undefined) ?? '';
  if (token && authService.verifyToken(token)) {
    next();
    return;
  }

  res.status(401).json({ error: 'authentication required' });
}
