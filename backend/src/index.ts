import { createApp } from './app';
import { prisma } from './prisma';

const PORT = Number(process.env.BACKEND_PORT ?? process.env.PORT ?? 3000);

async function main() {
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
