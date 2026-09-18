// Thin HTTP client for the KIRO-MCP backend REST API.
// Uses the compose service name (http://backend:3000) by default so the MCP
// server talks to the backend over the internal Docker network.

const BACKEND_URL = process.env.BACKEND_URL ?? 'http://backend:3000';

export interface Item {
  id: number;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
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
  health: () => request<{ status: string; database: string }>('/health'),
  listItems: () => request<Item[]>('/api/items'),
  getItem: (id: number) => request<Item>(`/api/items/${id}`),
  createItem: (name: string, description?: string | null) =>
    request<Item>('/api/items', {
      method: 'POST',
      body: JSON.stringify({ name, description: description ?? null }),
    }),
  updateItem: (id: number, data: { name?: string; description?: string | null }) =>
    request<Item>(`/api/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteItem: (id: number) =>
    request<void>(`/api/items/${id}`, { method: 'DELETE' }),
};
