# syntax=docker/dockerfile:1
# ==============================================================================
# KIRO-MCP Backend — multi-stage build
# Node.js 20 LTS (alpine) + TypeScript + Prisma
# ==============================================================================

# ---- Stage 1: dependencies (all deps, incl. dev, for building) ----
FROM node:20-alpine AS deps
WORKDIR /app
# Prisma engines need OpenSSL (libssl.so.3) present at generate/runtime on Alpine.
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
# Full install (dev deps needed for tsc/prisma generate)
RUN npm install

# ---- Stage 2: build (compile TS, generate Prisma client) ----
FROM node:20-alpine AS build
WORKDIR /app
RUN apk add --no-cache openssl
COPY --from=deps /app/node_modules ./node_modules
COPY package.json package-lock.json* ./
COPY tsconfig.json ./
COPY prisma ./prisma
COPY src ./src
RUN npx prisma generate
RUN npm run build

# ---- Stage 3: production dependencies only ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
# Prisma client must be generated for the production node_modules too
COPY prisma ./prisma
RUN npx prisma generate

# ---- Stage 4: runtime (minimal, non-root) ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production

# OpenSSL required by Prisma engines; wget (in base alpine) used by healthcheck.
RUN apk add --no-cache openssl
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY prisma ./prisma
COPY package.json ./
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh

# Run as the built-in non-root `node` user.
RUN chown -R node:node /app
USER node

EXPOSE 3000

# Healthcheck hits the /health endpoint (which also verifies DB connectivity).
HEALTHCHECK --interval=10s --timeout=5s --start-period=30s --retries=5 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:3000/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
