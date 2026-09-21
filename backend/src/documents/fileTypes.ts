// Supported document types + magic-number (file signature) validation.
// Extension alone is NOT trusted; we verify the file's leading bytes so a
// renamed executable/script cannot masquerade as an allowed document.

export type Category = 'pdf' | 'image' | 'presentation' | 'spreadsheet' | 'document' | 'text';
export type PreviewType = 'pdf' | 'image' | 'text' | 'markdown' | 'pptx' | 'unsupported';

export interface TypeSpec {
  ext: string;
  mime: string;
  category: Category;
  preview: PreviewType;
}

// The allow-list. Anything not here is rejected at upload.
export const TYPES: Record<string, TypeSpec> = {
  pdf: { ext: 'pdf', mime: 'application/pdf', category: 'pdf', preview: 'pdf' },
  png: { ext: 'png', mime: 'image/png', category: 'image', preview: 'image' },
  jpg: { ext: 'jpg', mime: 'image/jpeg', category: 'image', preview: 'image' },
  jpeg: { ext: 'jpeg', mime: 'image/jpeg', category: 'image', preview: 'image' },
  webp: { ext: 'webp', mime: 'image/webp', category: 'image', preview: 'image' },
  txt: { ext: 'txt', mime: 'text/plain', category: 'text', preview: 'text' },
  md: { ext: 'md', mime: 'text/markdown', category: 'text', preview: 'markdown' },
  // Office formats. PPTX renders client-side (pptx-preview, no server conversion).
  // Legacy PPT and Word/Excel are stored + downloadable (preview unsupported).
  doc: { ext: 'doc', mime: 'application/msword', category: 'document', preview: 'unsupported' },
  docx: { ext: 'docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', category: 'document', preview: 'unsupported' },
  ppt: { ext: 'ppt', mime: 'application/vnd.ms-powerpoint', category: 'presentation', preview: 'unsupported' },
  pptx: { ext: 'pptx', mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', category: 'presentation', preview: 'pptx' },
  xls: { ext: 'xls', mime: 'application/vnd.ms-excel', category: 'spreadsheet', preview: 'unsupported' },
  xlsx: { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', category: 'spreadsheet', preview: 'unsupported' },
};

export function specForExt(ext: string): TypeSpec | undefined {
  return TYPES[ext.toLowerCase()];
}

export const ALLOWED_EXTS = Object.keys(TYPES);

function startsWith(buf: Buffer, bytes: number[], offset = 0): boolean {
  if (buf.length < offset + bytes.length) return false;
  return bytes.every((b, i) => buf[offset + i] === b);
}

// Validate that the file content matches the claimed extension via magic bytes.
// Returns true if content is consistent with an allowed type.
export function validateSignature(ext: string, buf: Buffer): boolean {
  const e = ext.toLowerCase();
  switch (e) {
    case 'pdf':
      return startsWith(buf, [0x25, 0x50, 0x44, 0x46]); // %PDF
    case 'png':
      return startsWith(buf, [0x89, 0x50, 0x4e, 0x47]); // .PNG
    case 'jpg':
    case 'jpeg':
      return startsWith(buf, [0xff, 0xd8, 0xff]);
    case 'webp':
      // RIFF....WEBP
      return startsWith(buf, [0x52, 0x49, 0x46, 0x46]) && startsWith(buf, [0x57, 0x45, 0x42, 0x50], 8);
    case 'docx':
    case 'pptx':
    case 'xlsx':
      // OOXML = ZIP container (PK\x03\x04)
      return startsWith(buf, [0x50, 0x4b, 0x03, 0x04]);
    case 'doc':
    case 'ppt':
    case 'xls':
      // Legacy OLE compound file
      return startsWith(buf, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]);
    case 'txt':
    case 'md':
      // Text: reject if it looks like a script/HTML or contains a NUL byte.
      {
        const head = buf.subarray(0, 512).toString('utf8').trimStart().toLowerCase();
        if (buf.subarray(0, 1024).includes(0x00)) return false; // binary
        if (head.startsWith('<!doctype html') || head.startsWith('<html') || head.startsWith('<?php') || head.startsWith('<script')) return false;
        return true;
      }
    default:
      return false;
  }
}
