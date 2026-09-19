// Notion domain types + safe DTOs returned to callers. We never surface raw
// Notion API error bodies (which could echo secrets) to clients.

export interface NotionStatus {
  configured: boolean; // credential saved in DB
  connected: boolean; // credential valid + database reachable
  databaseId?: string; // masked when returned to clients
  tokenConfigured: boolean;
}

// A simplified page representation extracted from a Notion page object.
export interface NotionPageDto {
  id: string;
  title: string;
  properties: Record<string, unknown>; // simplified property values
  url?: string;
  createdTime?: string;
  lastEditedTime?: string;
}

// Property types we support when creating/updating pages.
export const SUPPORTED_PROPERTY_TYPES = [
  'title',
  'rich_text',
  'number',
  'select',
  'multi_select',
  'checkbox',
  'date',
  'url',
] as const;

export type SupportedPropertyType = (typeof SUPPORTED_PROPERTY_TYPES)[number];

// Safe, user-facing error for Notion problems (no secrets, no raw API bodies).
export class NotionError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 502,
  ) {
    super(message);
    this.name = 'NotionError';
  }
}

// Thrown when Notion is not configured/connected.
export class NotionNotConfiguredError extends NotionError {
  constructor(message = 'Notion이 연결되어 있지 않습니다. Settings에서 Notion을 연결해주세요.') {
    super(message, 409);
  }
}
