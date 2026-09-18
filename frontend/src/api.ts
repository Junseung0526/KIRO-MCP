// API base URL. Injected at build time via VITE_API_BASE_URL.
// The browser runs on the host, so this points at the host-mapped backend port
// (e.g. http://localhost:3000), NOT the internal compose service name.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface Item {
  id: number;
  name: string;
  description: string | null;
  created_at?: string;
  updated_at?: string;
}

export async function listItems(): Promise<Item[]> {
  const res = await fetch(`${API_BASE}/api/items`);
  if (!res.ok) throw new Error(`Failed to list items: ${res.status}`);
  return res.json();
}

export async function createItem(name: string, description: string): Promise<Item> {
  const res = await fetch(`${API_BASE}/api/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, description: description || null }),
  });
  if (!res.ok) throw new Error(`Failed to create item: ${res.status}`);
  return res.json();
}

export async function deleteItem(id: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/items/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`Failed to delete item: ${res.status}`);
}

export const apiBase = API_BASE;
