// E2E MCP client test: connects to the running MCP server over Streamable HTTP,
// lists tools, then calls all 7 tools to verify real backend/DB effects.
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const MCP_URL = process.env.MCP_URL ?? 'http://mcp-server:3100/mcp';

function text(res) {
  return res?.content?.map((c) => c.text).join('\n');
}

async function main() {
  const transport = new StreamableHTTPClientTransport(new URL(MCP_URL));
  const client = new Client({ name: 'e2e-test-client', version: '1.0.0' });
  await client.connect(transport);

  const tools = await client.listTools();
  const names = tools.tools.map((t) => t.name).sort();
  console.log('TOOLS:', JSON.stringify(names));

  const expected = ['create_item','delete_item','get_item','get_statistics','list_items','search_items','update_item'].sort();
  console.log('TOOLS_MATCH:', JSON.stringify(names) === JSON.stringify(expected));

  // list_items
  const before = await client.callTool({ name: 'list_items', arguments: {} });
  const beforeArr = JSON.parse(text(before));
  console.log('LIST_BEFORE_COUNT:', beforeArr.length);

  // create_item (real INSERT)
  const created = await client.callTool({ name: 'create_item', arguments: { name: 'MCP created item', description: 'inserted via MCP tool' } });
  const createdObj = JSON.parse(text(created));
  console.log('CREATED_ID:', createdObj.id, 'NAME:', createdObj.name);
  const id = createdObj.id;

  // get_item
  const got = await client.callTool({ name: 'get_item', arguments: { id } });
  console.log('GET_ITEM:', text(got).includes('MCP created item'));

  // update_item (real UPDATE, PATCH)
  const updated = await client.callTool({ name: 'update_item', arguments: { id, name: 'MCP updated item' } });
  console.log('UPDATED_NAME:', JSON.parse(text(updated)).name);

  // search_items
  const searched = await client.callTool({ name: 'search_items', arguments: { query: 'MCP updated' } });
  const searchedArr = JSON.parse(text(searched));
  console.log('SEARCH_HITS:', searchedArr.length, 'FOUND_ID:', searchedArr.some((i) => i.id === id));

  // get_statistics
  const stats = await client.callTool({ name: 'get_statistics', arguments: {} });
  console.log('STATS:', text(stats).replace(/\s+/g, ' '));

  // delete_item (real DELETE)
  const deleted = await client.callTool({ name: 'delete_item', arguments: { id } });
  console.log('DELETED:', text(deleted));

  // verify gone via search
  const after = await client.callTool({ name: 'search_items', arguments: { query: 'MCP updated' } });
  console.log('AFTER_DELETE_HITS:', JSON.parse(text(after)).length);

  await client.close();
  console.log('E2E_DONE');
}

main().catch((e) => { console.error('E2E_ERROR:', e?.message ?? e); process.exit(1); });
