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

export interface NotionPage {
  id: string;
  title: string;
  properties: Record<string, unknown>;
  url?: string;
  createdTime?: string;
  lastEditedTime?: string;
}

export interface DocumentDto {
  id: string;
  originalName: string;
  ext: string;
  mimeType: string;
  category: string;
  previewType: 'pdf' | 'image' | 'text' | 'markdown' | 'pptx' | 'unsupported';
  sizeBytes: number;
  pageCount: number | null;
  lastViewedAt: string | null;
  lastViewedPage: number | null;
  folderId: string | null;
  uploadedAt: string;
  updatedAt: string;
}

export interface StorageUsage {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  fileCount: number;
  usagePercent: number;
  byCategory: Record<string, number>;
}

export interface FolderDto {
  id: string;
  name: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
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

  // ---- Health (public) ----
  health: () =>
    fetch(`${API_BASE}/health`).then((r) => handle<{ status: string; database: string }>(r)),

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

  // SSE streaming chat. Calls onStatus for heartbeats/progress and resolves
  // with the final reply (or rejects on error). Same-origin cookies are sent
  // automatically by EventSource.
  chatStream(
    message: string,
    onStatus?: (state: string) => void,
  ): { promise: Promise<ChatReply>; cancel: () => void } {
    const url = `${API_BASE}/api/chat/stream?message=${encodeURIComponent(message)}`;
    const es = new EventSource(url, { withCredentials: true });
    let settled = false;
    const promise = new Promise<ChatReply>((resolve, reject) => {
      es.addEventListener('status', (e) => {
        try { onStatus?.(JSON.parse((e as MessageEvent).data).state); } catch { /* ignore */ }
      });
      es.addEventListener('result', (e) => {
        settled = true;
        es.close();
        try { resolve(JSON.parse((e as MessageEvent).data) as ChatReply); }
        catch { reject(new Error('bad result payload')); }
      });
      es.addEventListener('error', (e) => {
        // Distinguish app-level error events (with data) from transport errors.
        const data = (e as MessageEvent).data;
        if (data) {
          settled = true;
          es.close();
          try { reject(new Error(JSON.parse(data).error || 'chat failed')); }
          catch { reject(new Error('chat failed')); }
        } else if (!settled) {
          settled = true;
          es.close();
          reject(new Error('연결이 끊어졌습니다.'));
        }
      });
    });
    return { promise, cancel: () => { settled = true; es.close(); } };
  },

  // ---- Logs ----
  logs: (limit = 100) => req(`/api/logs?limit=${limit}`).then((r) => handle<LogEntry[]>(r)),

  // ---- Settings ----
  changePassword: (currentPassword: string, newPassword: string) =>
    jsonReq('/api/settings/password', 'POST', { currentPassword, newPassword }).then((r) =>
      handle<{ ok: boolean }>(r),
    ),

  // ---- Notion integration (Settings) ----
  notionStatus: () =>
    req('/api/settings/notion').then((r) =>
      handle<{ configured: boolean; connected: boolean; databaseId?: string; tokenConfigured: boolean }>(r),
    ),
  notionTest: (token: string, databaseId: string) =>
    jsonReq('/api/settings/notion/test', 'POST', { token, databaseId }).then((r) =>
      handle<{ ok: boolean; message: string }>(r),
    ),
  notionSave: (token: string, databaseId: string) =>
    jsonReq('/api/settings/notion', 'POST', { token, databaseId }).then((r) =>
      handle<{ configured: boolean; connected: boolean; databaseId?: string }>(r),
    ),
  notionDisconnect: () =>
    req('/api/settings/notion', { method: 'DELETE' }).then((r) => handle<{ ok: boolean }>(r)),

  // ---- Notion data (scoped to the connected database) ----
  notionListPages: () => req('/api/notion/list').then((r) => handle<NotionPage[]>(r)),
  notionSearchPages: (query: string) =>
    req(`/api/notion/search?query=${encodeURIComponent(query)}`).then((r) => handle<NotionPage[]>(r)),

  // ---- Documents (자료실) ----
  documents: (opts?: { q?: string; category?: string; sort?: string; folderId?: string }) => {
    const p = new URLSearchParams();
    if (opts?.q) p.set('q', opts.q);
    if (opts?.category && opts.category !== 'all') p.set('category', opts.category);
    if (opts?.sort) p.set('sort', opts.sort);
    if (opts?.folderId) p.set('folderId', opts.folderId); // 'none' = uncategorized, uuid, or omit=all
    const qs = p.toString();
    return req(`/api/documents${qs ? `?${qs}` : ''}`).then((r) => handle<DocumentDto[]>(r));
  },
  documentStorage: () => req('/api/documents/storage').then((r) => handle<StorageUsage>(r)),
  documentRecent: () => req('/api/documents/recent').then((r) => handle<DocumentDto[]>(r)),
  documentGet: (id: string) => req(`/api/documents/${id}`).then((r) => handle<DocumentDto>(r)),
  documentDelete: (id: string) => req(`/api/documents/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),
  documentMove: (id: string, folderId: string | null) =>
    jsonReq(`/api/documents/${id}/folder`, 'PATCH', { folderId }).then((r) => handle<DocumentDto>(r)),
  documentRecordView: (id: string, page?: number) =>
    jsonReq(`/api/documents/${id}/view`, 'POST', { page }).then((r) => handle<DocumentDto>(r)),
  documentFileUrl: (id: string, download = false) =>
    `${API_BASE}/api/documents/${id}/file${download ? '?download=1' : ''}`,
  documentUpload: (file: File, folderId: string | null, onProgress?: (pct: number) => void) =>
    new Promise<DocumentDto>((resolve, reject) => {
      const form = new FormData();
      form.append('file', file);
      if (folderId) form.append('folderId', folderId);
      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/api/documents`);
      xhr.withCredentials = true;
      xhr.upload.onprogress = (e) => { if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100)); };
      xhr.onload = () => {
        if (xhr.status >= 200 && xhr.status < 300) { try { resolve(JSON.parse(xhr.responseText)); } catch { reject(new Error('bad response')); } }
        else { let m = `업로드 실패 (${xhr.status})`; try { m = JSON.parse(xhr.responseText).error || m; } catch { /* */ } reject(new Error(m)); }
      };
      xhr.onerror = () => reject(new Error('네트워크 오류'));
      xhr.send(form);
    }),

  // ---- Folders (과목) ----
  folders: () => req('/api/folders').then((r) => handle<FolderDto[]>(r)),
  folderCreate: (name: string) => jsonReq('/api/folders', 'POST', { name }).then((r) => handle<FolderDto>(r)),
  folderRename: (id: string, name: string) => jsonReq(`/api/folders/${id}`, 'PATCH', { name }).then((r) => handle<FolderDto>(r)),
  folderDelete: (id: string) => req(`/api/folders/${id}`, { method: 'DELETE' }).then((r) => handle<void>(r)),
};
