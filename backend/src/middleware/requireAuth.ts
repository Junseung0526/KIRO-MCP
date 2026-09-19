// requireAuth middleware: allows the request only when a valid session JWT is
// present in the httpOnly cookie. Protects CRUD, chat, logs, and settings APIs.
import { NextFunction, Request, Response } from 'express';
import { config } from '../config';
import { authService } from '../services/auth.service';

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const token = (req.cookies?.[config.cookieName] as string | undefined) ?? '';
  if (!token || !authService.verifyToken(token)) {
    res.status(401).json({ error: 'authentication required' });
    return;
  }
  next();
}
