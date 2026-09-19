// Minimal application logger: writes to console AND persists to the app_logs
// table. NEVER logs secrets — callers must pass only high-level messages.
// A best-effort secret scrubber strips common secret-looking substrings.
import { prisma } from './prisma';

type Level = 'info' | 'warn' | 'error';

// Redact obvious secrets if they ever slip into a message.
const SECRET_PATTERNS: RegExp[] = [
  /(password"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(token"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(secret"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(api[_-]?key"?\s*[:=]\s*)("?[^",\s]+)/gi,
  /(Bearer\s+)([A-Za-z0-9._-]+)/g,
  /(eyJ[A-Za-z0-9._-]{10,})/g, // JWT-looking tokens
];

export function scrub(text: string | undefined | null): string {
  if (!text) return '';
  let out = String(text);
  for (const re of SECRET_PATTERNS) out = out.replace(re, (_m, p1) => `${p1 ?? ''}[REDACTED]`);
  return out;
}

export interface LogInput {
  level: Level;
  event: string;
  message?: string;
  correlationId?: string;
}

export const logger = {
  async log({ level, event, message, correlationId }: LogInput): Promise<void> {
    const safeMessage = scrub(message);
    // Console (stdout/stderr) — scrubbed.
    const line = `[${level}] ${event}${correlationId ? ` (${correlationId})` : ''}${safeMessage ? ` ${safeMessage}` : ''}`;
    if (level === 'error') console.error(line);
    else console.log(line);
    // Persist (best-effort; never throw from logging).
    try {
      await prisma.appLog.create({
        data: { level, event, message: safeMessage || null, correlationId: correlationId || null },
      });
    } catch {
      /* ignore logging failures */
    }
  },

  info(event: string, message?: string, correlationId?: string) {
    return this.log({ level: 'info', event, message, correlationId });
  },
  warn(event: string, message?: string, correlationId?: string) {
    return this.log({ level: 'warn', event, message, correlationId });
  },
  error(event: string, message?: string, correlationId?: string) {
    return this.log({ level: 'error', event, message, correlationId });
  },

  async recent(limit = 100) {
    return prisma.appLog.findMany({ orderBy: { id: 'desc' }, take: Math.min(limit, 500) });
  },
};
