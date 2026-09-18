# syntax=docker/dockerfile:1
# ==============================================================================
# KIRO-MCP MCP Server — multi-stage build (Node.js 20 LTS)
# Standard MCP server (stdio + streamable HTTP), AI-agnostic.
# ==============================================================================

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# ---- Stage 2: production deps only ----
FROM node:20-alpine AS prod-deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install --omit=dev

# ---- Stage 3: runtime (minimal, non-root) ----
FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
COPY --from=prod-deps /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER node

# Default HTTP transport port (only used when MCP_TRANSPORT=http)
EXPOSE 3100

CMD ["node", "dist/index.js"]
