// Thin HTTP client for the KIRO-MCP backend REST API.
// Uses the compose service name (http://backend:3000) by default so the MCP
// server talks to the backend over the internal Docker network.
//
// SECURITY: This client ONLY calls the fixed set of backend REST endpoints.
// It performs no arbitrary URL requests, no shell, no SQL, no file access.

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:3000';

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
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
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
};
