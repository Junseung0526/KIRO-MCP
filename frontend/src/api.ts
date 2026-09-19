// API client for the KIRO-MCP backend REST API.
// Same-origin: relative paths, proxied by nginx to the backend. Cookies
// (httpOnly session) are sent automatically via credentials: 'include'.
const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

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

export interface AuthStatus {
  initialized: boolean;
  authenticated: boolean;
}

export interface LogEntry {
  id: number;
  level: string;
  event: string;
  message: string | null;
  correlationId: string | null;
  createdAt: string;
}

export interface ChatReply {
  correlationId: string;
  reply: string;
  durationMs: number;
}

// Thrown so callers can detect auth loss and redirect to login.
export class UnauthorizedError extends Error {}

async function handle<T>(res: Response): Promise<T> {
  if (res.status === 401) throw new UnauthorizedError('authentication required');
  if (!res.ok) {
    let message = `${res.status} ${res.statusText}`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

function req(path: string, init?: RequestInit) {
  return fetch(`${API_BASE}${path}`, { credentials: 'include', ...init });
}

function jsonReq(path: string, method: string, body?: unknown) {
  return req(path, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

export const api = {
  base: API_BASE,

  // ---- Auth ----
  authStatus: () => req('/api/auth/status').then((r) => handle<AuthStatus>(r)),
  setupPassword: (password: string) =>
    jsonReq('/api/auth/setup', 'POST', { password }).then((r) => handle<{ ok: boolean }>(r)),
  login: (password: string) =>
    jsonReq('/api/auth/login', 'POST', { password }).then((r) => handle<{ ok: boolean }>(r)),
  logout: () => jsonReq('/api/auth/logout', 'POST').then((r) => handle<{ ok: boolean }>(r)),

  // ---- Items ----
  listItems: () => req('/api/items').then((r) => handle<Item[]>(r)),
  getItem: (id: number) => req(`/api/items/${id}`).then((r) => handle<Item>(r)),
  searchItems: (q: string) =>
    req(`/api/items/search?q=${encodeURIComponent(q)}`).then((r) => handle<Item[]>(r)),
  statistics: () => req('/api/items/statistics').then((r) => handle<Statistics>(r)),
  createItem: (name: string, description: string | null) =>
    jsonReq('/api/items', 'POST', { name, description }).then((r) => handle<Item>(r)),
  updateItem: (id: number, data: { name?: string; description?: string | null }) =>
    jsonReq(`/api/items/${id}`, 'PATCH', data).then((r) => handle<Item>(r)),
  deleteItem: (id: number) => req(`/api/items/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),

  // ---- Chat ----
  chatStatus: () => req('/api/chat/status').then((r) => handle<{ configured: boolean }>(r)),
  chat: (message: string) => jsonReq('/api/chat', 'POST', { message }).then((r) => handle<ChatReply>(r)),

  // ---- Logs ----
  logs: (limit = 100) => req(`/api/logs?limit=${limit}`).then((r) => handle<LogEntry[]>(r)),

  // ---- Settings ----
  changePassword: (currentPassword: string, newPassword: string) =>
    jsonReq('/api/settings/password', 'POST', { currentPassword, newPassword }).then((r) =>
      handle<{ ok: boolean }>(r),
    ),
};
