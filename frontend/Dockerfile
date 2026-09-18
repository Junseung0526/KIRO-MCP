# syntax=docker/dockerfile:1
# ==============================================================================
# KIRO-MCP Frontend — production build served by nginx
# ==============================================================================

# ---- Stage 1: build ----
FROM node:20-alpine AS build
WORKDIR /app
# API base URL is baked in at build time (Vite env).
ARG VITE_API_BASE_URL=http://localhost:3000
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json vite.config.ts index.html ./
COPY src ./src
RUN npm run build

# ---- Stage 2: serve with nginx (non-root) ----
FROM nginx:1.27-alpine AS runtime
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK --interval=15s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://127.0.0.1:80/ || exit 1
