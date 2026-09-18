# KIRO-MCP

Dockerized full-stack **Model Context Protocol (MCP)** platform. An AI client
(Kiro, Antigravity, or any MCP client) talks to an MCP server, which calls a
REST backend, which persists to PostgreSQL via Prisma. A React web UI uses the
same backend REST API.

```
AI Client (Kiro / Antigravity / other MCP client)
        │
        ▼
   MCP Server            ← exposes exactly 7 allowed tools (default-deny)
        │  HTTP (http://backend:3000)
        ▼
     Backend  (Express + TypeScript)
        │
        ▼
      Prisma
        │
        ▼
   PostgreSQL 16

Frontend (React + Vite) ──HTTP──► Backend ──► PostgreSQL
```

The MCP server **never** runs arbitrary SQL or shell commands. It only calls the
fixed set of backend REST endpoints.

---

## Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Backend    | Node.js 20 LTS, TypeScript, Express, Prisma  |
| Database   | PostgreSQL 16                                 |
| MCP Server | Official MCP TypeScript SDK (`@modelcontextprotocol/sdk`) |
| Frontend   | React, TypeScript, Vite (served by nginx)    |
| Infra      | Docker, Docker Compose                         |

---

## Directory Structure

```
KIRO-MCP/
├── compose.yml              # base compose (prod-like): 4 services
├── compose.dev.yml          # dev overrides (hot reload, DB host port)
├── compose.prod.yml         # prod overrides (logging, restart always)
├── .env.example             # template for environment variables
├── .env                     # real env (gitignored, never committed)
├── backend/
│   ├── Dockerfile
│   ├── docker-entrypoint.sh # migrate deploy + seed + start
│   ├── prisma/
│   │   ├── schema.prisma
│   │   └── migrations/
│   └── src/
│       ├── index.ts                     # server bootstrap
│       ├── app.ts                        # express app assembly
│       ├── config.ts                     # runtime config
│       ├── prisma.ts                     # Prisma client
│       ├── errors.ts                     # AppError + error handler + asyncHandler
│       ├── dto/item.dto.ts               # zod schemas + DTO types
│       ├── repositories/item.repository.ts
│       ├── services/item.service.ts
│       ├── controllers/item.controller.ts
│       ├── routes/item.routes.ts
│       ├── routes/health.routes.ts
│       └── seed.ts
├── mcp-server/
│   ├── Dockerfile
│   ├── mcp-e2e-test.mjs     # E2E test exercising all 7 tools
│   └── src/
│       ├── index.ts         # registers exactly 7 tools (default-deny)
│       └── backend.ts       # thin REST client to the backend
└── frontend/
    ├── Dockerfile           # build + nginx serve
    ├── Dockerfile.dev       # vite dev server
    ├── nginx.conf
    └── src/
        ├── api.ts           # backend REST client
        ├── App.tsx          # list/detail/create/update/delete/search UI
        └── main.tsx
```

---

## Environment Variables

Copy `.env.example` to `.env` and adjust values. **Never commit `.env`.**

| Variable            | Used by            | Description                                            |
|---------------------|--------------------|--------------------------------------------------------|
| `NODE_ENV`          | backend            | `production` / `development`                           |
| `BACKEND_PORT`      | backend, host map  | Backend port (default `3000`)                          |
| `POSTGRES_USER`     | database, backend  | DB user                                                |
| `POSTGRES_PASSWORD` | database, backend  | DB password (secret — keep out of git)                 |
| `POSTGRES_DB`       | database, backend  | DB name                                                |
| `DATABASE_URL`      | backend (Prisma)   | Full connection string; host is `database` (service)   |
| `BACKEND_URL`       | mcp-server         | `http://backend:3000` (compose service name)           |
| `MCP_TRANSPORT`     | mcp-server         | `http` (default) or `stdio`                            |
| `MCP_HTTP_PORT`     | mcp-server         | MCP HTTP port (default `3100`)                         |
| `FRONTEND_PORT`     | host map           | Host port for the frontend (default `8080`)            |
| `VITE_API_BASE_URL` | frontend build     | Browser-facing backend URL (e.g. `http://localhost:3000`) |

> Inside the compose network, services reach each other by **service name**
> (`database`, `backend`), not `localhost`. The browser uses the host-mapped
> backend port via `VITE_API_BASE_URL`.

---

## Running with Docker

```bash
# 1) Prepare environment
cp .env.example .env        # then edit secrets

# 2) Build (verbose logs)
docker compose build --progress=plain

# 3) Start
docker compose up -d

# 4) Check status
docker compose ps
```

Ports (base compose):

| Service    | Container | Host                         |
|------------|-----------|------------------------------|
| frontend   | 80        | `127.0.0.1:3000` (loopback)  |
| backend    | 3000      | *(not exposed — internal)*   |
| mcp-server | 3100      | `3100`                       |
| database   | 5432      | *(not exposed)*              |

### Public access (production: https://gri22ly.me)

The whole app is served from a single origin. A **host nginx** terminates TLS
for `gri22ly.me` (Let's Encrypt) and reverse-proxies to the frontend container
on `127.0.0.1:3000`. The frontend nginx then serves the React UI and proxies
`/api/*` and `/health` to the backend over the internal network.

```
https://gri22ly.me
   │  (host nginx :443, TLS; :80 → 301 → :443)
   ▼
127.0.0.1:3000  ─ frontend container (nginx)
   ├── /            → React SPA
   ├── /api/*       → backend:3000
   └── /health      → backend:3000
```

- HTTP → HTTPS redirect is handled by the host nginx.
- The backend (`:3000` in-container) and PostgreSQL (`:5432`) are **not** exposed
  to the public internet; the frontend port binds to loopback only.
- The browser uses **relative** API paths (`/api/...`), so no CORS and no
  hardcoded host/IP. Set `VITE_API_BASE_URL` empty for same-origin.

Dev mode (hot reload + DB exposed on host):

```bash
docker compose -f compose.yml -f compose.dev.yml up -d --build
```

---

## Database Migration & Seed

Migrations and seeding run **automatically** on backend startup via
`backend/docker-entrypoint.sh`:

```sh
npx prisma migrate deploy     # apply migrations
node dist/seed.js             # idempotent seed (only when table is empty)
node dist/index.js            # start server
```

Manual (inside the backend container):

```bash
docker compose exec backend npx prisma migrate deploy
docker compose exec backend node dist/seed.js
```

The `Item` model:

```prisma
model Item {
  id          Int      @id @default(autoincrement())
  name        String
  description String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt      @map("updated_at")

  @@index([name])
  @@map("items")
}
```

---

## Backend API

Base URL: `http://localhost:3000`

| Method | Path                        | Description                     | Success |
|--------|-----------------------------|---------------------------------|---------|
| GET    | `/health`                   | Liveness + DB readiness         | 200 / 503 |
| GET    | `/api/items`                | List all items (also `?q=`)     | 200 |
| GET    | `/api/items/search?q=term`  | Search by name/description      | 200 |
| GET    | `/api/items/statistics`     | Aggregate statistics            | 200 |
| GET    | `/api/items/:id`            | Get one item                    | 200 / 404 |
| POST   | `/api/items`                | Create item                     | 201 / 400 |
| PATCH  | `/api/items/:id`            | Partial update                  | 200 / 400 / 404 |
| DELETE | `/api/items/:id`            | Delete item                     | 204 / 404 |

Request body (create/update):

```json
{ "name": "string (required on create)", "description": "string | null (optional)" }
```

Validation errors return `400` with a `details` array. Not-found returns `404`.
The backend uses a **layered architecture**: Controller → Service → Repository,
with DTO/zod validation and centralized exception handling.

---

## MCP Server

- Transport: **Streamable HTTP** (default) on `http://<host>:3100/mcp`, or
  **stdio** when `MCP_TRANSPORT=stdio`.
- Stateless HTTP: each JSON-RPC request is self-contained.
- Every tool calls the real backend REST API → real PostgreSQL. **No mock data.**
- All tool inputs are validated with zod schemas.

### MCP Tools (exactly these 7 — default deny)

| Tool             | Input                                   | Backend call                        |
|------------------|-----------------------------------------|-------------------------------------|
| `list_items`     | —                                       | `GET /api/items`                    |
| `get_item`       | `id: number`                            | `GET /api/items/:id`                |
| `create_item`    | `name: string`, `description?: string`  | `POST /api/items`                   |
| `update_item`    | `id`, `name?`, `description?`           | `PATCH /api/items/:id`              |
| `delete_item`    | `id: number`                            | `DELETE /api/items/:id`             |
| `search_items`   | `query: string`                         | `GET /api/items/search?q=`          |
| `get_statistics` | —                                       | `GET /api/items/statistics`         |

No other tools exist. There is no arbitrary shell, SQL, file, proxy, or
bulk-delete/DB-reset tool.

### Connecting an MCP Client

HTTP (remote clients such as Antigravity):

```json
{
  "mcpServers": {
    "kiro-mcp": { "url": "http://localhost:3100/mcp" }
  }
}
```

stdio (client spawns the process):

```json
{
  "mcpServers": {
    "kiro-mcp": {
      "command": "node",
      "args": ["dist/index.js"],
      "env": { "MCP_TRANSPORT": "stdio", "BACKEND_URL": "http://localhost:3000" }
    }
  }
}
```

---

## Testing

Backend REST (host):

```bash
curl -s http://localhost:3000/health
curl -s http://localhost:3000/api/items
curl -s -X POST http://localhost:3000/api/items \
  -H 'Content-Type: application/json' -d '{"name":"demo","description":"d"}'
curl -s "http://localhost:3000/api/items/search?q=demo"
curl -s http://localhost:3000/api/items/statistics
```

MCP tools (official SDK client, run inside the mcp-server container which has
the SDK installed):

```bash
docker compose exec mcp-server node /app/mcp-e2e-test.mjs
```

Verify a real DB change end-to-end (MCP → backend → Prisma → PostgreSQL):

```bash
# create via MCP, then query Postgres directly
docker compose exec database psql -U kiro -d kiro_mcp \
  -c "SELECT id, name FROM items ORDER BY id;"
```

---

## Security Constraints

- **Default deny**: the MCP server registers only the 7 tools above.
- No tool for: arbitrary shell, arbitrary SQL, file read/write, `.env` access,
  SSH/OCI/credential access, docker socket, `sudo`, generic HTTP proxy, or
  arbitrary URL requests.
- No bulk-delete / database-reset tool.
- All MCP inputs are schema-validated (zod).
- The MCP HTTP server only serves the `/mcp` endpoint; all other paths return 404.
- Backend never leaks internals/secrets in errors; no secrets are logged.
- Containers run as a non-root `node` user. The Docker socket is never mounted.
- PostgreSQL is not exposed to the host in the base/prod compose files.

---

## Troubleshooting

**`Could not parse schema engine response` (Prisma on Alpine)**
Prisma needs OpenSSL (`libssl.so.3`). The backend Dockerfile installs `openssl`
in every node stage and the schema sets
`binaryTargets = ["native", "linux-musl-openssl-3.0.x"]`.

**MCP `TS2739: ... missing ~standard/~validate`**
MCP SDK 1.12.1 uses zod v4 internal types (Standard Schema) introduced in zod
3.24+. Pin a single zod version ≥ 3.25 (this repo uses `3.25.76`) to avoid two
mismatched zod copies.

**MCP `Bad Request: Server not initialized`**
The HTTP transport must be stateless (`sessionIdGenerator: undefined`) when a new
server instance is created per request.

**Backend unhealthy on first boot**
It waits for the database healthcheck. Check `docker compose logs backend`.

**Low-memory build (OOM)**
On small hosts, build services one at a time:
`docker compose build backend`, then `mcp-server`, then `frontend`. Ensure swap
is enabled (`swapon --show`).

---

## Roadmap

The platform is designed to grow into a personal AI management web app:
first-run password setup → login → Dashboard / Items / Chat / Logs / Settings,
where Chat performs real backend/DB operations **only** through the allowed MCP
tools, with real-time updates via SSE/WebSocket. Core CRUD → MCP → DB is
complete and verified first; the auth/chat/real-time layers build on top.
