// Thin HTTP client for the KIRO-MCP backend REST API.
// Uses the compose service name (http://backend:3000) by default so the MCP
// server talks to the backend over the internal Docker network.
//
// SECURITY: This client ONLY calls the fixed set of backend REST endpoints.
// It performs no arbitrary URL requests, no shell, no SQL, no file access.

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:3000';
// Internal service token so the MCP server can call the auth-protected item API.
const INTERNAL_TOKEN = process.env.INTERNAL_API_TOKEN ?? '';

export interface Item {
  id: number;
  name: string;
  description: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface Statistics {
  totalItems: number;
  itemsWithDescription: number;
  itemsWithoutDescription: number;
  latestItem: Item | null;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(INTERNAL_TOKEN ? { 'X-Internal-Token': INTERNAL_TOKEN } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Backend ${res.status} ${res.statusText}: ${body}`);
  }
  if (res.status === 204) {
    return undefined as T;
  }
  return (await res.json()) as T;
}

export const backend = {
  base: BACKEND_URL,

  listItems: () => request<Item[]>('/api/items'),

  getItem: (id: number) => request<Item>(`/api/items/${id}`),

  searchItems: (q: string) =>
    request<Item[]>(`/api/items/search?q=${encodeURIComponent(q)}`),

  statistics: () => request<Statistics>('/api/items/statistics'),

  createItem: (name: string, description?: string | null) =>
    request<Item>('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name, description: description ?? null }),
    }),

  updateItem: (id: number, data: { name?: string; description?: string | null }) =>
    request<Item>(`/api/items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  deleteItem: (id: number) => request<void>(`/api/items/${id}`, { method: 'DELETE' }),

  // ---- Notion (scoped to the stored database; token never passed here) ----
  notionList: () => request<unknown[]>('/api/notion/list'),
  notionSearch: (query: string) =>
    request<unknown[]>(`/api/notion/search?query=${encodeURIComponent(query)}`),
  notionGet: (id: string) => request<unknown>(`/api/notion/page/${encodeURIComponent(id)}`),
  notionSchema: () => request<Record<string, { type: string; name: string }>>('/api/notion/schema'),
  notionCreate: (values: Record<string, unknown>) =>
    request<unknown>('/api/notion/page', { method: 'POST', body: JSON.stringify({ values }) }),
  notionUpdate: (id: string, values: Record<string, unknown>) =>
    request<unknown>('/api/notion/page', {
      method: 'PATCH',
      body: JSON.stringify({ id, values }),
    }),
};
