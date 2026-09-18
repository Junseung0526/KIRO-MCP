// API client for the KIRO-MCP backend REST API.
// API base URL is injected at build time via VITE_API_BASE_URL.
// The browser runs on the host, so this points at the host-mapped backend port
// (e.g. http://localhost:3000), NOT the internal compose service name.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface Item {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Statistics {
  totalItems: number;
  itemsWithDescription: number;
  itemsWithoutDescription: number;
  latestItem: Item | null;
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore parse errors */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export const api = {
  base: API_BASE,

  listItems: () => fetch(`${API_BASE}/api/items`).then((r) => handle<Item[]>(r)),

  getItem: (id: number) => fetch(`${API_BASE}/api/items/${id}`).then((r) => handle<Item>(r)),

  searchItems: (q: string) =>
    fetch(`${API_BASE}/api/items/search?q=${encodeURIComponent(q)}`).then((r) => handle<Item[]>(r)),

  statistics: () => fetch(`${API_BASE}/api/items/statistics`).then((r) => handle<Statistics>(r)),

  createItem: (name: string, description: string | null) =>
    fetch(`${API_BASE}/api/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description }),
    }).then((r) => handle<Item>(r)),

  updateItem: (id: number, data: { name?: string; description?: string | null }) =>
    fetch(`${API_BASE}/api/items/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }).then((r) => handle<Item>(r)),

  deleteItem: (id: number) =>
    fetch(`${API_BASE}/api/items/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),
};
