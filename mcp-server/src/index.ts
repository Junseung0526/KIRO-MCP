import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { z } from 'zod';
import { backend } from './backend.js';

// ---------------------------------------------------------------------------
// Build a fresh McpServer with all KIRO-MCP tools registered.
// Every tool calls the real backend REST API, which persists to PostgreSQL.
// No mock data.
// ---------------------------------------------------------------------------
function buildServer(): McpServer {
  const server = new McpServer({
    name: 'kiro-mcp-server',
    version: '0.1.0',
  });

  const asJson = (data: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  });

  server.registerTool(
    'health_check',
    {
      description: 'Check backend and database health via the backend /health endpoint.',
      inputSchema: {},
    },
    async () => asJson(await backend.health())
  );

  server.registerTool(
    'list_items',
    {
      description: 'List all items stored in the PostgreSQL database (via backend REST API).',
      inputSchema: {},
    },
    async () => asJson(await backend.listItems())
  );

  server.registerTool(
    'get_item',
    {
      description: 'Get a single item by its numeric id.',
      inputSchema: { id: z.number().int().describe('The item id') },
    },
    async ({ id }) => asJson(await backend.getItem(id))
  );

  server.registerTool(
    'create_item',
    {
      description:
        'Create a new item. This performs a real INSERT into PostgreSQL through the backend.',
      inputSchema: {
        name: z.string().min(1).describe('Item name (required)'),
        description: z.string().nullable().optional().describe('Optional description'),
      },
    },
    async ({ name, description }) => asJson(await backend.createItem(name, description ?? null))
  );

  server.registerTool(
    'update_item',
    {
      description: 'Update an existing item by id. Performs a real UPDATE in PostgreSQL.',
      inputSchema: {
        id: z.number().int().describe('The item id to update'),
        name: z.string().min(1).optional().describe('New name'),
        description: z.string().nullable().optional().describe('New description'),
      },
    },
    async ({ id, name, description }) => {
      const data: { name?: string; description?: string | null } = {};
      if (name !== undefined) data.name = name;
      if (description !== undefined) data.description = description;
      return asJson(await backend.updateItem(id, data));
    }
  );

  server.registerTool(
    'delete_item',
    {
      description: 'Delete an item by id. Performs a real DELETE in PostgreSQL.',
      inputSchema: { id: z.number().int().describe('The item id to delete') },
    },
    async ({ id }) => {
      await backend.deleteItem(id);
      return asJson({ deleted: true, id });
    }
  );

  return server;
}

// ---------------------------------------------------------------------------
// Transport selection:
//   MCP_TRANSPORT=stdio  -> stdio (default; used when a client spawns us)
//   MCP_TRANSPORT=http   -> Streamable HTTP on MCP_HTTP_PORT (default 3100)
// Supporting both keeps the server AI-agnostic (Kiro, Antigravity, etc.).
// ---------------------------------------------------------------------------
async function main() {
  const transportKind = (process.env.MCP_TRANSPORT ?? 'stdio').toLowerCase();

  if (transportKind === 'http') {
    const port = Number(process.env.MCP_HTTP_PORT ?? 3100);

    const httpServer = createServer(async (req, res) => {
      if (req.url !== '/mcp') {
        res.writeHead(404).end();
        return;
      }
      // Stateless: build a new server+transport per request.
      const server = buildServer();
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: () => randomUUID(),
      });
      res.on('close', () => {
        void transport.close();
        void server.close();
      });
      await server.connect(transport);

      // Collect the JSON body (if any) and hand it to the transport.
      const chunks: Buffer[] = [];
      req.on('data', (c) => chunks.push(c as Buffer));
      req.on('end', async () => {
        let body: unknown = undefined;
        if (chunks.length > 0) {
          try {
            body = JSON.parse(Buffer.concat(chunks).toString('utf-8'));
          } catch {
            body = undefined;
          }
        }
        await transport.handleRequest(req, res, body);
      });
    });

    httpServer.listen(port, () => {
      console.error(`[mcp] streamable HTTP transport listening on :${port}/mcp`);
      console.error(`[mcp] backend base URL: ${backend.base}`);
    });
  } else {
    const server = buildServer();
    const transport = new StdioServerTransport();
    await server.connect(transport);
    // stdout is reserved for the MCP protocol; log to stderr.
    console.error('[mcp] stdio transport connected');
    console.error(`[mcp] backend base URL: ${backend.base}`);
  }
}

main().catch((err) => {
  console.error('[mcp] fatal:', err instanceof Error ? err.message : err);
  process.exit(1);
});
