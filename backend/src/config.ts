// Centralized runtime configuration. Secrets come from the environment
// (.env, never committed) and are never logged.
export const config = {
  port: Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 3000),
  nodeEnv: process.env.NODE_ENV ?? 'development',

  // Auth
  jwtSecret: process.env.JWT_SECRET ?? '',
  // Session lifetime for the auth cookie/JWT (seconds). Default 12h.
  sessionTtlSeconds: Number(process.env.SESSION_TTL_SECONDS ?? 12 * 60 * 60),
  cookieName: 'kiro_session',
  // Set Secure cookie flag when served over HTTPS (production behind nginx TLS).
  cookieSecure: (process.env.COOKIE_SECURE ?? 'true').toLowerCase() === 'true',

  // Kiro bridge (host-side process that runs `kiro-cli`)
  kiroBridgeUrl: process.env.KIRO_BRIDGE_URL ?? '',
  kiroBridgeToken: process.env.KIRO_BRIDGE_TOKEN ?? '',
  // Internal service token: lets the MCP server (internal network) call the
  // protected item API on behalf of Kiro tool calls. Never exposed to browsers.
  internalApiToken: process.env.INTERNAL_API_TOKEN ?? '',

  // Encryption key (hex, 64 chars = 32 bytes) for at-rest credential encryption
  // (e.g. the Notion integration token). Comes from .env; never logged/committed.
  credentialEncryptionKey: process.env.CREDENTIAL_ENCRYPTION_KEY ?? '',
  // Max time to wait for a chat/Kiro run (ms).
  chatTimeoutMs: Number(process.env.CHAT_TIMEOUT_MS ?? 120_000),

  // ---- Document Library storage ----
  // Directory where uploaded files are stored (backed by a persistent volume).
  documentStorageDir: process.env.DOCUMENT_STORAGE_DIR ?? '/app/storage/documents',
  // Per-file upload limit (MB) and total storage cap (GB).
  maxFileSizeMb: Number(process.env.MAX_FILE_SIZE_MB ?? 100),
  maxStorageGb: Number(process.env.MAX_STORAGE_GB ?? 5),
} as const;

export function assertAuthConfigured(): void {
  if (!config.jwtSecret || config.jwtSecret.length < 16) {
    throw new Error(
      'JWT_SECRET is not configured (must be set in .env, min 16 chars). Refusing to start auth.',
    );
  }
}
