// Auth controller: status/setup/login/logout/me. Sets/clears the httpOnly
// session cookie. Never logs passwords.
import { Request, Response } from 'express';
import { z } from 'zod';
import { config } from '../config';
import { authService } from '../services/auth.service';
import { logger } from '../logger';

const passwordSchema = z.object({ password: z.string().min(1, 'password required') });

function cookieOptions() {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax' as const,
    maxAge: config.sessionTtlSeconds * 1000,
    path: '/',
  };
}

export const authController = {
  // GET /api/auth/status — is the app initialized, and is the caller authed?
  async status(req: Request, res: Response): Promise<void> {
    const initialized = await authService.isInitialized();
    const token = (req.cookies?.[config.cookieName] as string | undefined) ?? '';
    const authenticated = Boolean(token) && authService.verifyToken(token);
    res.json({ initialized, authenticated });
  },

  // POST /api/auth/setup — first-run password creation.
  async setup(req: Request, res: Response): Promise<void> {
    const { password } = passwordSchema.parse(req.body ?? {});
    await authService.setup(password);
    await logger.info('auth.setup.success', 'initial password set');
    // Auto-login after setup.
    const token = authService.issueToken();
    res.cookie(config.cookieName, token, cookieOptions());
    res.status(201).json({ ok: true });
  },

  // POST /api/auth/login
  async login(req: Request, res: Response): Promise<void> {
    const { password } = passwordSchema.parse(req.body ?? {});
    const ok = await authService.verifyPassword(password);
    if (!ok) {
      await logger.warn('auth.login.failure', 'invalid password attempt');
      res.status(401).json({ error: 'invalid credentials' });
      return;
    }
    const token = authService.issueToken();
    res.cookie(config.cookieName, token, cookieOptions());
    await logger.info('auth.login.success', 'user logged in');
    res.json({ ok: true });
  },

  // POST /api/auth/logout
  async logout(_req: Request, res: Response): Promise<void> {
    res.clearCookie(config.cookieName, { ...cookieOptions(), maxAge: undefined });
    await logger.info('auth.logout', 'user logged out');
    res.json({ ok: true });
  },

  // GET /api/auth/me — requires auth (mounted behind requireAuth).
  async me(_req: Request, res: Response): Promise<void> {
    res.json({ user: 'owner' });
  },
};
