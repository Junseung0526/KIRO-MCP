import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { folderService } from '../documents/folder.service';

export const folderRouter = Router();
folderRouter.use(requireAuth);

const idParam = z.object({ id: z.string().uuid() });
const nameBody = z.object({ name: z.string().trim().min(1).max(100) });

// GET /api/folders — list folders with document counts.
folderRouter.get('/', asyncHandler(async (_req: Request, res: Response) => {
  res.json(await folderService.list());
}));

// POST /api/folders — create a subject folder.
folderRouter.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name } = nameBody.parse(req.body ?? {});
  res.status(201).json(await folderService.create(name));
}));

// PATCH /api/folders/:id — rename.
folderRouter.patch('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  const { name } = nameBody.parse(req.body ?? {});
  res.json(await folderService.rename(id, name));
}));

// DELETE /api/folders/:id — delete folder (documents become uncategorized).
folderRouter.delete('/:id', asyncHandler(async (req: Request, res: Response) => {
  const { id } = idParam.parse(req.params);
  await folderService.delete(id);
  res.status(204).send();
}));
