// StorageService: abstracts file persistence so the backend can later swap
// local disk for S3/OCI Object Storage without touching the document service.
//
// SECURITY: callers pass a storedName (UUID + ext) that we generate — never a
// user-supplied path. resolvePath() confirms the final path stays within the
// storage root (defense-in-depth against path traversal).
import { createReadStream, createWriteStream, ReadStream } from 'node:fs';
import { mkdir, rm, stat, readdir } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { config } from '../config';

export interface StorageStat { sizeBytes: number }

export interface StorageService {
  ensureReady(): Promise<void>;
  save(storedName: string, source: Readable | string): Promise<StorageStat>;
  createReadStream(storedName: string, opts?: { start?: number; end?: number }): ReadStream;
  delete(storedName: string): Promise<void>;
  exists(storedName: string): Promise<boolean>;
  size(storedName: string): Promise<number>;
  usedBytes(): Promise<number>;
}

class LocalStorageService implements StorageService {
  private root = config.documentStorageDir;

  // Resolve a stored file path and ensure it stays inside the storage root.
  private resolvePath(storedName: string): string {
    // Only allow a bare filename (no separators) — we control this value.
    if (storedName.includes('/') || storedName.includes('\\') || storedName.includes('..')) {
      throw new Error('invalid stored name');
    }
    const full = path.resolve(this.root, storedName);
    if (!full.startsWith(path.resolve(this.root) + path.sep)) {
      throw new Error('path escapes storage root');
    }
    return full;
  }

  async ensureReady(): Promise<void> {
    await mkdir(this.root, { recursive: true });
  }

  async save(storedName: string, source: Readable | string): Promise<StorageStat> {
    const full = this.resolvePath(storedName);
    if (typeof source === 'string') {
      // source is a temp file path (multer disk storage) → stream-copy it.
      await pipeline(createReadStream(source), createWriteStream(full));
    } else {
      await pipeline(source, createWriteStream(full));
    }
    const s = await stat(full);
    return { sizeBytes: s.size };
  }

  createReadStream(storedName: string, opts?: { start?: number; end?: number }): ReadStream {
    const full = this.resolvePath(storedName);
    return createReadStream(full, opts);
  }

  async delete(storedName: string): Promise<void> {
    const full = this.resolvePath(storedName);
    await rm(full, { force: true });
  }

  async exists(storedName: string): Promise<boolean> {
    try { await stat(this.resolvePath(storedName)); return true; } catch { return false; }
  }

  async size(storedName: string): Promise<number> {
    const s = await stat(this.resolvePath(storedName));
    return s.size;
  }

  // Sum of all files in the storage root (actual disk usage of documents).
  async usedBytes(): Promise<number> {
    try {
      const files = await readdir(this.root);
      let total = 0;
      for (const f of files) {
        try { total += (await stat(path.join(this.root, f))).size; } catch { /* skip */ }
      }
      return total;
    } catch {
      return 0;
    }
  }
}

export const storageService: StorageService = new LocalStorageService();
