// DocumentService: business logic for the document library. Validates uploads
// (extension + magic-number), stores via StorageService, persists metadata,
// and computes storage usage. Never trusts user-supplied paths/filenames.
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { Document } from '@prisma/client';
import { config } from '../config';
import { BadRequestError, NotFoundError, AppError } from '../errors';
import { logger } from '../logger';
import { documentRepository, SortKey } from '../repositories/document.repository';
import { storageService } from './storage.service';
import { specForExt, validateSignature, ALLOWED_EXTS } from './fileTypes';

export interface DocumentDto {
  id: string;
  originalName: string;
  ext: string;
  mimeType: string;
  category: string;
  previewType: string;
  sizeBytes: number;
  pageCount: number | null;
  lastViewedAt: string | null;
  lastViewedPage: number | null;
  uploadedAt: string;
  updatedAt: string;
}

function toDto(d: Document): DocumentDto {
  return {
    id: d.id, originalName: d.originalName, ext: d.ext, mimeType: d.mimeType,
    category: d.category, previewType: d.previewType, sizeBytes: d.sizeBytes,
    pageCount: d.pageCount, lastViewedAt: d.lastViewedAt?.toISOString() ?? null,
    lastViewedPage: d.lastViewedPage, uploadedAt: d.uploadedAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

function normalizeExt(name: string): string {
  return path.extname(name).replace('.', '').toLowerCase();
}

// multer decodes the multipart filename as latin1, which mangles UTF-8 names
// (e.g. Korean). Re-interpret the latin1 bytes as UTF-8 to recover the real
// name. If the result isn't valid UTF-8, fall back to the original.
function decodeFilename(name: string): string {
  try {
    const utf8 = Buffer.from(name, 'latin1').toString('utf8');
    // If re-encoding round-trips, latin1->utf8 was the correct interpretation.
    if (Buffer.from(utf8, 'utf8').toString('latin1') === name && !utf8.includes('\uFFFD')) {
      return utf8;
    }
  } catch {
    /* ignore */
  }
  return name;
}

export interface StorageUsage {
  usedBytes: number;
  totalBytes: number;
  remainingBytes: number;
  fileCount: number;
  usagePercent: number;
  byCategory: Record<string, number>;
}

export const documentService = {
  async list(q: string | undefined, category: string | undefined, sort: SortKey): Promise<DocumentDto[]> {
    const docs = await documentRepository.list({ q, category, sort });
    return docs.map(toDto);
  },

  async get(id: string): Promise<DocumentDto> {
    const d = await documentRepository.findById(id);
    if (!d) throw new NotFoundError('document not found');
    return toDto(d);
  },

  async recentlyViewed(limit = 5): Promise<DocumentDto[]> {
    return (await documentRepository.recentlyViewed(limit)).map(toDto);
  },

  // Handle an uploaded temp file (multer disk storage): validate, store, persist.
  async create(file: { originalname: string; path: string; size: number }): Promise<DocumentDto> {
    const originalName = decodeFilename(file.originalname);
    const ext = normalizeExt(originalName);
    const spec = specForExt(ext);
    if (!spec) {
      throw new BadRequestError(
        `지원하지 않는 파일 형식입니다. 허용: ${ALLOWED_EXTS.join(', ')}`,
      );
    }
    // Size cap.
    const maxBytes = config.maxFileSizeMb * 1024 * 1024;
    if (file.size > maxBytes) {
      throw new BadRequestError(`파일이 너무 큽니다 (최대 ${config.maxFileSizeMb}MB).`);
    }
    // Storage cap.
    const used = await storageService.usedBytes();
    const totalBytes = config.maxStorageGb * 1024 * 1024 * 1024;
    if (used + file.size > totalBytes) {
      throw new AppError(507, '저장공간이 부족해 업로드할 수 없습니다.');
    }
    // Magic-number check on the first bytes.
    const head = Buffer.alloc(1024);
    const fd = await readFile(file.path);
    fd.copy(head, 0, 0, Math.min(1024, fd.length));
    if (!validateSignature(ext, fd)) {
      throw new BadRequestError('파일 내용이 형식과 일치하지 않습니다.');
    }

    const storedName = `${randomUUID()}.${ext}`;
    await storageService.save(storedName, file.path);

    const doc = await documentRepository.create({
      originalName: originalName.slice(0, 255),
      storedName,
      mimeType: spec.mime,
      ext: spec.ext,
      category: spec.category,
      previewType: spec.preview,
      sizeBytes: file.size,
      storagePath: storedName,
    });
    await logger.info('document.upload', `uploaded ${spec.ext} (${file.size}B)`);
    return toDto(doc);
  },

  async delete(id: string): Promise<void> {
    const d = await documentRepository.findById(id);
    if (!d) throw new NotFoundError('document not found');
    // Delete metadata first, then the file. If file delete fails we log but
    // don't resurrect the row; a sweep could clean orphans later.
    await documentRepository.delete(id);
    try {
      await storageService.delete(d.storedName);
    } catch {
      await logger.warn('document.delete.orphan', `file left on disk for ${id}`);
    }
    await logger.info('document.delete', `deleted document`);
  },

  async recordView(id: string, page?: number): Promise<DocumentDto> {
    const d = await documentRepository.findById(id);
    if (!d) throw new NotFoundError('document not found');
    return toDto(await documentRepository.touchView(id, page));
  },

  // Resolve the stored file for streaming (returns metadata + a stream factory).
  async openForStream(id: string): Promise<{ doc: Document }> {
    const d = await documentRepository.findById(id);
    if (!d) throw new NotFoundError('document not found');
    if (!(await storageService.exists(d.storedName))) {
      throw new NotFoundError('file missing on storage');
    }
    return { doc: d };
  },

  streamFactory(storedName: string, range?: { start: number; end: number }) {
    return storageService.createReadStream(storedName, range);
  },

  async storage(): Promise<StorageUsage> {
    const [usedDisk, fileCount, byCategory] = await Promise.all([
      storageService.usedBytes(),
      documentRepository.count(),
      documentRepository.countByCategory(),
    ]);
    const totalBytes = config.maxStorageGb * 1024 * 1024 * 1024;
    const usedBytes = usedDisk;
    const remainingBytes = Math.max(totalBytes - usedBytes, 0);
    const usagePercent = totalBytes > 0 ? Math.round((usedBytes / totalBytes) * 1000) / 10 : 0;
    return { usedBytes, totalBytes, remainingBytes, fileCount, usagePercent, byCategory };
  },
};
