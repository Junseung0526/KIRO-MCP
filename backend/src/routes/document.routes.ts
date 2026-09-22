import { Router } from 'express';
import multer from 'multer';
import os from 'node:os';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { config } from '../config';
import { documentController } from '../documents/document.controller';

export const documentRouter = Router();

// Multer: store to a temp dir (disk, not memory) to keep RAM flat on large
// uploads. The service then streams it into permanent storage. Size-capped.
const upload = multer({
  dest: os.tmpdir(),
  limits: { fileSize: config.maxFileSizeMb * 1024 * 1024, files: 1 },
});

// All document endpoints require an authenticated session (or internal token).
documentRouter.use(requireAuth);

// Specific routes before dynamic ":id".
documentRouter.get('/storage', asyncHandler(documentController.storage));
documentRouter.get('/recent', asyncHandler(documentController.recent));

documentRouter.get('/', asyncHandler(documentController.list));
documentRouter.post('/', upload.single('file'), asyncHandler(documentController.create));

documentRouter.get('/:id', asyncHandler(documentController.get));
documentRouter.get('/:id/file', asyncHandler(documentController.file));
documentRouter.post('/:id/view', asyncHandler(documentController.recordView));
documentRouter.patch('/:id/folder', asyncHandler(documentController.move));
documentRouter.delete('/:id', asyncHandler(documentController.remove));
