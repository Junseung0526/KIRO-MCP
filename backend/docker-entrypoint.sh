#!/bin/sh
set -e

echo "[entrypoint] applying database migrations..."
npx prisma migrate deploy

echo "[entrypoint] seeding database (idempotent)..."
node dist/seed.js || echo "[entrypoint] seed skipped/failed (non-fatal)"

echo "[entrypoint] starting backend..."
exec node dist/index.js
