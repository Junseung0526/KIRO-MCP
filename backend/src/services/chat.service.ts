// Chat service: forwards the user's natural-language message to the host-side
// Kiro bridge, which runs `kiro-cli` with the locked-down `kiro_mcp` agent.
// Kiro selects and calls the 7 allowlisted MCP tools; the bridge returns the
// assistant's text. This layer adds timeouts, correlation IDs, and logging.
//
// It does NOT run shell/SQL/arbitrary commands. It only calls the bridge.
import { randomUUID } from 'node:crypto';
import { config } from '../config';
import { logger } from '../logger';

export interface ChatResult {
  correlationId: string;
  reply: string;
  durationMs: number;
}

export class ChatConfigError extends Error {}

export const chatService = {
  isConfigured(): boolean {
    return Boolean(config.kiroBridgeUrl);
  },

  async ask(message: string): Promise<ChatResult> {
    if (!this.isConfigured()) {
      // Clear configuration error — never a fake AI response.
      throw new ChatConfigError(
        'Chat is not configured: KIRO_BRIDGE_URL is unset. The host-side Kiro bridge must be running and reachable.',
      );
    }

    const correlationId = randomUUID();
    await logger.info('chat.request', `message received (len=${message.length})`, correlationId);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.chatTimeoutMs + 5_000);

    try {
      const res = await fetch(`${config.kiroBridgeUrl.replace(/\/$/, '')}/run`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(config.kiroBridgeToken ? { 'X-Bridge-Token': config.kiroBridgeToken } : {}),
        },
        body: JSON.stringify({ message, correlationId }),
        signal: controller.signal,
      });

      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        output?: string;
        error?: string;
        durationMs?: number;
      };

      if (!res.ok || data.ok === false) {
        await logger.error(
          'chat.bridge.error',
          `bridge status=${res.status} err=${data.error ?? 'unknown'}`,
          correlationId,
        );
        throw new Error(data.error ?? `Kiro bridge error (status ${res.status})`);
      }

      const reply = (data.output ?? '').trim();
      await logger.info(
        'chat.response',
        `reply produced (len=${reply.length}, ${data.durationMs ?? 0}ms)`,
        correlationId,
      );
      return { correlationId, reply, durationMs: data.durationMs ?? 0 };
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        await logger.error('chat.timeout', 'kiro bridge timed out', correlationId);
        throw new Error('Chat request timed out');
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
};
