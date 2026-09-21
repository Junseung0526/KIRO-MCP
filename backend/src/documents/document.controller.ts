import { Request, Response } from 'express';
import { z } from 'zod';
import { BadRequestError } from '../errors';
import { documentService } from './document.service';
import { SortKey } from '../repositories/document.repository';

const listQuery = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.enum(['all', 'pdf', 'image', 'presentation', 'spreadsheet', 'document', 'text']).optional(),
  sort: z.enum(['recent', 'oldest', 'name', 'size', 'viewed']).optional(),
});
const idParam = z.object({ id: z.string().uuid('invalid id') });
const viewBody = z.object({ page: z.coerce.number().int().min(0).max(100000).optional() });

export const documentController = {
  async list(req: Request, res: Response) {
    const { q, category, sort } = listQuery.parse(req.query);
    res.json(await documentService.list(q, category, (sort ?? 'recent') as SortKey));
  },

  async storage(_req: Request, res: Response) {
    res.json(await documentService.storage());
  },

  async recent(_req: Request, res: Response) {
    res.json(await documentService.recentlyViewed(5));
  },

  async get(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    res.json(await documentService.get(id));
  },

  async create(req: Request, res: Response) {
    const file = (req as Request & { file?: Express.Multer.File }).file;
    if (!file) throw new BadRequestError('파일이 필요합니다.');
    res.status(201).json(await documentService.create(file));
  },

  async remove(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    await documentService.delete(id);
    res.status(204).send();
  },

  async recordView(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    const { page } = viewBody.parse(req.body ?? {});
    res.json(await documentService.recordView(id, page));
  },

  // Stream the file with Range support. inline for previewable, attachment for download.
  async file(req: Request, res: Response) {
    const { id } = idParam.parse(req.params);
    const download = req.query.download === '1';
    const { doc } = await documentService.openForStream(id);
    const size = doc.sizeBytes;
    const disposition = `${download ? 'attachment' : 'inline'}; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`;

    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', disposition);
    res.setHeader('Accept-Ranges', 'bytes');
    // Prevent inline HTML/script execution risk on any served file.
    res.setHeader('X-Content-Type-Options', 'nosniff');

    const range = req.headers.range;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        const start = m[1] ? parseInt(m[1], 10) : 0;
        const end = m[2] ? parseInt(m[2], 10) : size - 1;
        if (start >= size || end >= size || start > end) {
          res.status(416).setHeader('Content-Range', `bytes */${size}`).end();
          return;
        }
        res.status(206);
        res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`);
        res.setHeader('Content-Length', end - start + 1);
        documentService.streamFactory(doc.storedName, { start, end }).pipe(res);
        return;
      }
    }
    res.setHeader('Content-Length', size);
    documentService.streamFactory(doc.storedName).pipe(res);
  },
};
