// NotionService: the ONLY place that talks to the Notion API. It always uses
// the credential stored in the DB (token decrypted on demand) and is locked to
// the single saved databaseId. It never accepts a token as an argument and
// never lets callers target an arbitrary database/page.
//
// SECURITY:
//  - Token is decrypted only in memory, only when needed, never logged/returned.
//  - All reads/writes are scoped to the stored databaseId (Default Deny).
//  - get/update verify the page belongs to the stored database before acting.
//  - Raw Notion error bodies are never forwarded to clients.
import { Client } from '@notionhq/client';
import { logger } from '../logger';
import { credentialService } from '../services/credential.service';
import { notionCredentialRepository } from '../repositories/notionCredential.repository';
import {
  NotionError,
  NotionNotConfiguredError,
  NotionPageDto,
  NotionStatus,
  SUPPORTED_PROPERTY_TYPES,
  SupportedPropertyType,
} from './notion.types';

function maskDatabaseId(id: string): string {
  if (!id) return '';
  const tail = id.replace(/-/g, '').slice(-4);
  return `********${tail}`;
}

// Build a Notion client from a raw token (used for connection tests before save).
function clientFor(token: string): Client {
  return new Client({ auth: token });
}

// Extract a plain title string from a Notion page.
function extractTitle(page: any): string {
  const props = page?.properties ?? {};
  for (const key of Object.keys(props)) {
    const p = props[key];
    if (p?.type === 'title') {
      return (p.title ?? []).map((t: any) => t.plain_text ?? '').join('') || '(제목 없음)';
    }
  }
  return '(제목 없음)';
}

// Simplify a Notion page's properties into plain values for display.
function simplifyProperties(page: any): Record<string, unknown> {
  const props = page?.properties ?? {};
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(props)) {
    const p = props[key];
    switch (p?.type) {
      case 'title':
        out[key] = (p.title ?? []).map((t: any) => t.plain_text ?? '').join('');
        break;
      case 'rich_text':
        out[key] = (p.rich_text ?? []).map((t: any) => t.plain_text ?? '').join('');
        break;
      case 'number':
        out[key] = p.number;
        break;
      case 'select':
        out[key] = p.select?.name ?? null;
        break;
      case 'multi_select':
        out[key] = (p.multi_select ?? []).map((s: any) => s.name);
        break;
      case 'checkbox':
        out[key] = p.checkbox;
        break;
      case 'date':
        out[key] = p.date?.start ?? null;
        break;
      case 'url':
        out[key] = p.url ?? null;
        break;
      default:
        out[key] = `(${p?.type ?? 'unknown'} — 미지원 표시)`;
    }
  }
  return out;
}

function toPageDto(page: any): NotionPageDto {
  return {
    id: page.id,
    title: extractTitle(page),
    properties: simplifyProperties(page),
    url: page.url,
    createdTime: page.created_time,
    lastEditedTime: page.last_edited_time,
  };
}

// Convert a user-supplied {propName: value} map into Notion property payloads,
// based on the ACTUAL database schema (no hardcoded property names/types).
function buildPropertiesPayload(
  schema: Record<string, { type: string; name: string }>,
  values: Record<string, unknown>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(values)) {
    const prop = schema[name];
    if (!prop) {
      throw new NotionError(`Notion DB에 "${name}" 속성이 없습니다.`, 400);
    }
    const type = prop.type as SupportedPropertyType;
    if (!SUPPORTED_PROPERTY_TYPES.includes(type)) {
      throw new NotionError(
        `현재 연결된 Notion DB의 "${name}" 속성은 지원하지 않는 타입입니다 (${prop.type}).`,
        400,
      );
    }
    switch (type) {
      case 'title':
        payload[name] = { title: [{ text: { content: String(value) } }] };
        break;
      case 'rich_text':
        payload[name] = { rich_text: [{ text: { content: String(value) } }] };
        break;
      case 'number':
        payload[name] = { number: value === null || value === '' ? null : Number(value) };
        break;
      case 'select':
        payload[name] = value ? { select: { name: String(value) } } : { select: null };
        break;
      case 'multi_select':
        payload[name] = {
          multi_select: (Array.isArray(value) ? value : [value])
            .filter((v) => v !== null && v !== undefined && v !== '')
            .map((v) => ({ name: String(v) })),
        };
        break;
      case 'checkbox':
        payload[name] = { checkbox: Boolean(value) };
        break;
      case 'date':
        payload[name] = value ? { date: { start: String(value) } } : { date: null };
        break;
      case 'url':
        payload[name] = { url: value ? String(value) : null };
        break;
    }
  }
  return payload;
}

async function loadCredential(): Promise<{ token: string; databaseId: string }> {
  const row = await notionCredentialRepository.find();
  if (!row) throw new NotionNotConfiguredError();
  let token: string;
  try {
    token = credentialService.decrypt(row.encryptedToken);
  } catch {
    // Decryption failed (e.g. key changed) — treat as not configured.
    throw new NotionNotConfiguredError('Notion 자격 증명을 복호화할 수 없습니다. 다시 연결해주세요.');
  }
  return { token, databaseId: row.databaseId };
}

// Wrap Notion SDK calls so raw error bodies never leak; log safely.
async function safe<T>(op: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err: any) {
    // Log only high-level info (status/code), never the token or full body.
    const code = err?.code ?? err?.status ?? 'unknown';
    await logger.error('notion.api.error', `${op} failed (code=${code})`);
    if (err?.status === 401 || err?.code === 'unauthorized') {
      throw new NotionError('Notion 인증에 실패했습니다. Token을 확인해주세요.', 502);
    }
    if (err?.status === 404 || err?.code === 'object_not_found') {
      throw new NotionError('Notion 대상을 찾을 수 없거나 접근 권한이 없습니다.', 502);
    }
    throw new NotionError('Notion API 요청에 실패했습니다.');
  }
}

export const notionService = {
  // ---- Status / configuration ----
  async status(): Promise<NotionStatus> {
    const row = await notionCredentialRepository.find();
    if (!row) return { configured: false, connected: false, tokenConfigured: false };
    // Try a lightweight connection check.
    let connected = false;
    try {
      const { token, databaseId } = await loadCredential();
      await clientFor(token).databases.retrieve({ database_id: databaseId });
      connected = true;
    } catch {
      connected = false;
    }
    return {
      configured: true,
      connected,
      databaseId: maskDatabaseId(row.databaseId),
      tokenConfigured: true,
    };
  },

  // Test a candidate token+databaseId WITHOUT saving. Returns true on success.
  async test(token: string, databaseId: string): Promise<void> {
    const cleanDb = databaseId.replace(/-/g, '').trim();
    if (!token || token.trim().length < 10) {
      throw new NotionError('유효한 Integration Token을 입력해주세요.', 400);
    }
    if (!/^[0-9a-fA-F]{32}$/.test(cleanDb)) {
      throw new NotionError('유효한 Database ID를 입력해주세요.', 400);
    }
    await safe('databases.retrieve', () =>
      clientFor(token).databases.retrieve({ database_id: databaseId }),
    );
  },

  // Save (encrypt) the credential after a successful connection test.
  async save(token: string, databaseId: string): Promise<void> {
    await this.test(token, databaseId);
    const encryptedToken = credentialService.encrypt(token);
    await notionCredentialRepository.upsert(encryptedToken, databaseId.trim());
    await logger.info('notion.credential.saved', 'notion credential stored (encrypted)');
  },

  async remove(): Promise<void> {
    await notionCredentialRepository.remove();
    await logger.info('notion.credential.removed', 'notion credential deleted');
  },

  // ---- Database schema (property names -> types) ----
  async getSchema(): Promise<Record<string, { type: string; name: string }>> {
    const { token, databaseId } = await loadCredential();
    const db: any = await safe('databases.retrieve', () =>
      clientFor(token).databases.retrieve({ database_id: databaseId }),
    );
    const schema: Record<string, { type: string; name: string }> = {};
    for (const [name, prop] of Object.entries<any>(db.properties ?? {})) {
      schema[name] = { type: prop.type, name };
    }
    return schema;
  },

  // ---- Tools (always scoped to the stored database) ----
  async list(limit = 50): Promise<NotionPageDto[]> {
    const { token, databaseId } = await loadCredential();
    const resp: any = await safe('databases.query', () =>
      clientFor(token).databases.query({ database_id: databaseId, page_size: Math.min(limit, 100) }),
    );
    return (resp.results ?? []).map(toPageDto);
  },

  // Search within the stored database only (client-side filter on titles).
  async search(query: string, limit = 50): Promise<NotionPageDto[]> {
    const pages = await this.list(100);
    const q = query.toLowerCase();
    return pages
      .filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          Object.values(p.properties).some(
            (v) => typeof v === 'string' && v.toLowerCase().includes(q),
          ),
      )
      .slice(0, limit);
  },

  // Get a page — but ONLY if it belongs to the stored database.
  async get(pageId: string): Promise<NotionPageDto> {
    const { token, databaseId } = await loadCredential();
    const page: any = await safe('pages.retrieve', () =>
      clientFor(token).pages.retrieve({ page_id: pageId }),
    );
    this.assertPageInDatabase(page, databaseId);
    return toPageDto(page);
  },

  async create(values: Record<string, unknown>): Promise<NotionPageDto> {
    const { token, databaseId } = await loadCredential();
    const schema = await this.getSchema();
    const properties = buildPropertiesPayload(schema, values);
    const page: any = await safe('pages.create', () =>
      clientFor(token).pages.create({ parent: { database_id: databaseId }, properties: properties as any }),
    );
    return toPageDto(page);
  },

  async update(pageId: string, values: Record<string, unknown>): Promise<NotionPageDto> {
    const { token, databaseId } = await loadCredential();
    // Verify the page belongs to the stored database BEFORE updating.
    const existing: any = await safe('pages.retrieve', () =>
      clientFor(token).pages.retrieve({ page_id: pageId }),
    );
    this.assertPageInDatabase(existing, databaseId);
    const schema = await this.getSchema();
    const properties = buildPropertiesPayload(schema, values);
    const page: any = await safe('pages.update', () =>
      clientFor(token).pages.update({ page_id: pageId, properties: properties as any }),
    );
    return toPageDto(page);
  },

  // Guard: reject pages that are not children of the stored database.
  assertPageInDatabase(page: any, databaseId: string): void {
    const parent = page?.parent;
    const norm = (s: string) => (s || '').replace(/-/g, '');
    if (parent?.type !== 'database_id' || norm(parent.database_id) !== norm(databaseId)) {
      throw new NotionError('해당 페이지는 연결된 Notion Database에 속하지 않습니다.', 403);
    }
  },
};
