import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createServer } from 'node:http';
import { z } from 'zod';
import { backend } from './backend.js';

// ---------------------------------------------------------------------------
// SECURITY MODEL — DEFAULT DENY
// Only the seven tools below are registered. Nothing else is exposed.
// There is NO tool for: arbitrary shell, arbitrary SQL, file read/write,
// .env access, SSH/OCI/credential access, docker socket, sudo, generic HTTP
// proxy, or arbitrary URL fetching. There is NO bulk-delete / DB-reset tool.
//
// Every tool calls the real backend REST API, which persists to PostgreSQL.
// No mock data. All inputs are validated with zod schemas.
// ---------------------------------------------------------------------------

// The exact allow-list of tool names (used for the startup log / audit).
const ALLOWED_TOOLS = [
  'list_items',
  'get_item',
  'create_item',
  'update_item',
  'delete_item',
  'search_items',
  'get_statistics',
] as const;

function buildServer(): McpServer {
  const server = new McpServer({
    name: 'kiro-mcp-server',
    version: '0.1.0',
  });

  const asJson = (data: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  });

  // 1) list_items — read all items
  server.registerTool(
    'list_items',
    {
      description: 'List all items stored in PostgreSQL (via the backend REST API).',
      inputSchema: {},
    },
    async () => asJson(await backend.listItems()),
  );

  // 2) get_item — read one item by id
  server.registerTool(
    'get_item',
    {
      description: 'Get a single item by its numeric id.',
      inputSchema: { id: z.number().int().positive().describe('The item id') },
    },
    async ({ id }) => asJson(await backend.getItem(id)),
  );

  // 3) create_item — real INSERT
  server.registerTool(
    'create_item',
    {
      description:
        'Create a new item. Performs a real INSERT into PostgreSQL through the backend.',
      inputSchema: {
        name: z.string().min(1).max(200).describe('Item name (required)'),
        description: z.string().max(2000).nullable().optional().describe('Optional description'),
      },
    },
    async ({ name, description }) => asJson(await backend.createItem(name, description ?? null)),
  );

  // 4) update_item — real UPDATE (PATCH semantics)
  server.registerTool(
    'update_item',
    {
      description: 'Update an existing item by id. Performs a real UPDATE in PostgreSQL.',
      inputSchema: {
        id: z.number().int().positive().describe('The item id to update'),
        name: z.string().min(1).max(200).optional().describe('New name'),
        description: z.string().max(2000).nullable().optional().describe('New description'),
      },
    },
    async ({ id, name, description }) => {
      const data: { name?: string; description?: string | null } = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      return asJson(await backend.updateItem(id, data));
    },
  );

  // 5) delete_item — real DELETE (single item only; no bulk delete)
  server.registerTool(
    'delete_item',
    {
      description: 'Delete a single item by id. Performs a real DELETE in PostgreSQL.',
      inputSchema: { id: z.number().int().positive().describe('The item id to delete') },
    },
    async ({ id }) => {
      await backend.deleteItem(id);
      return asJson({ deleted: true, id });
    },
  );

  // 6) search_items — search by keyword
  server.registerTool(
    'search_items',
    {
      description:
        'Search items by keyword (case-insensitive, matches name and description) via the backend.',
      inputSchema: { query: z.string().min(1).max(200).describe('Search keyword') },
    },
    async ({ query }) => asJson(await backend.searchItems(query)),
  );

  // 7) get_statistics — aggregate stats
  server.registerTool(
    'get_statistics',
    {
      description:
        'Get aggregate statistics about items (totals, with/without description, latest).',
      inputSchema: {},
    },
    async () => asJson(await backend.statistics()),
  );

  return server;
}

// ---------------------------------------------------------------------------
// Transport selection:
//   MCP_TRANSPORT=stdio  -> stdio (used when a client spawns the process)
//   MCP_TRANSPORT=http   -> Streamable HTTP on MCP_HTTP_PORT (default 3100)
// Supporting both keeps the server AI-agnostic (Kiro, Antigravity, etc.).
// ---------------------------------------------------------------------------
async function main() {
  const transportKind = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();

  if (transportKind === 'http') {
    const port = Number(process.env.MCP_HTTP_PORT ?? 3100);

    const httpServer = createServer((req, res) => {
      // Only the /mcp endpoint is served; everything else is denied.
      if (req.url !== '/mcp') {
        res.writeHead(404).end();
        return;
      }
      // Stateless: build a fresh server + transport per request.
      // sessionIdGenerator: undefined => no session tracking, so each
      // self-contained JSON-RPC request (incl. initialize) is handled
      // independently. This matches the per-request server instance above.
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined,
      });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });

      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', () => {
        let body: unknown = undefined;
        if (chunks.length > 0) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          } catch {
            body = undefined;
          }
        }
        void server.connect(transport).then(() => transport.handleRequest(req, res, body));
      });
    });

    httpServer.listen(port, () => {
      console.error(`[mcp] streamable HTTP transport listening on :${port}/mcp`);
      console.error(`[mcp] backend base URL: ${backend.base}`);
      console.error(`[mcp] allowed tools (default-deny): ${ALLOWED_TOOLS.join(', ')}`);
    });
  } else {
    const server = buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stdout is reserved for the MCP protocol; log to stderr only.
    console.error('[mcp] stdio transport connected');
    console.error(`[mcp] backend base URL: ${backend.base}`);
    console.error(`[mcp] allowed tools (default-deny): ${ALLOWED_TOOLS.join(', ')}`);
  }
}

main().catch((err) => {
  console.error('[mcp] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
