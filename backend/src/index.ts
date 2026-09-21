import { createApp } from './app';
import { prisma } from './prisma';
import { config, assertAuthConfigured } from './config';
import { storageService } from './documents/storage.service';

const PORT = config.port;

async function main() {
  // Fail fast if auth secrets are missing (never run with an insecure default).
  assertAuthConfigured();

  // Ensure the document storage directory exists (persistent volume mount).
  await storageService.ensureReady();

  const app = createApp();

  const server = app.listen(PORT, () => {
    console.log(`[backend] listening on port ${PORT}`);
  });

  const shutdown = async (signal: string) => {
    console.log(`[backend] received ${signal}, shutting down`);
    server.close(async () => {
      await prisma.$disconnect();
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));
}

main().catch((err) => {
  console.error('[backend] fatal startup error:', err instanceof Error ? err.message : err);
  process.exit(1);
});
