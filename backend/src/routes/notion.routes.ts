// /api/notion/* — Notion tool endpoints, called by the MCP server (internal
// token) or the browser (session cookie). All operations are scoped to the
// stored database; the token is never accepted here.
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../errors';
import { requireAuth } from '../middleware/requireAuth';
import { notionService } from '../notion/notion.service';
import { NotionError } from '../notion/notion.types';

export const notionRouter = Router();

notionRouter.use(requireAuth);

// Translate NotionError into its safe status/message; re-throw others.
function handleNotion(err: unknown, res: Response, next: NextFunction) {
  if (err instanceof NotionError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }
  next(err);
}

const searchSchema = z.object({ query: z.string().trim().min(1).max(200) });
const idSchema = z.object({ id: z.string().trim().min(20) });
// Property values: an object of { propertyName: value }.
const valuesSchema = z.object({ values: z.record(z.string(), z.unknown()) });
const updateSchema = z.object({
  id: z.string().trim().min(20),
  values: z.record(z.string(), z.unknown()),
});

// GET /api/notion/schema — property names/types of the connected database.
notionRouter.get(
  '/schema',
  asyncHandler(async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await notionService.getSchema());
    } catch (err) {
      handleNotion(err, res, next);
    }
  }),
);

// GET /api/notion/list
notionRouter.get(
  '/list',
  asyncHandler(async (_req: Request, res: Response, next: NextFunction) => {
    try {
      res.json(await notionService.list());
    } catch (err) {
      handleNotion(err, res, next);
    }
  }),
);

// GET /api/notion/search?query=
notionRouter.get(
  '/search',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { query } = searchSchema.parse({ query: req.query.query });
      res.json(await notionService.search(query));
    } catch (err) {
      handleNotion(err, res, next);
    }
  }),
);

// GET /api/notion/page/:id
notionRouter.get(
  '/page/:id',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = idSchema.parse({ id: req.params.id });
      res.json(await notionService.get(id));
    } catch (err) {
      handleNotion(err, res, next);
    }
  }),
);

// POST /api/notion/page   body: { values: {...} }
notionRouter.post(
  '/page',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { values } = valuesSchema.parse(req.body ?? {});
      res.status(201).json(await notionService.create(values));
    } catch (err) {
      handleNotion(err, res, next);
    }
  }),
);

// PATCH /api/notion/page  body: { id, values: {...} }
notionRouter.patch(
  '/page',
  asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id, values } = updateSchema.parse(req.body ?? {});
      res.json(await notionService.update(id, values));
    } catch (err) {
      handleNotion(err, res, next);
    }
  }),
);
