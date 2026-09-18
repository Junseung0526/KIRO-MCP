// Controller layer: HTTP concerns only — parse/validate input, call the
// service, shape the HTTP response. No business logic, no DB access here.
import { Request, Response } from 'express';
import {
  createItemSchema,
  idParamSchema,
  listQuerySchema,
  updateItemSchema,
} from '../dto/item.dto';
import { BadRequestError } from '../errors';
import { itemService } from '../services/item.service';

export const itemController = {
  // GET /api/items  (optional ?q= for convenience)
  async list(req: Request, res: Response): Promise<void> {
    const { q } = listQuerySchema.parse(req.query);
    const items = q ? await itemService.search(q) : await itemService.list();
    res.json(items);
  },

  // GET /api/items/search?q=term
  async search(req: Request, res: Response): Promise<void> {
    const { q } = listQuerySchema.parse(req.query);
    if (!q) throw new BadRequestError('query parameter "q" is required');
    const items = await itemService.search(q);
    res.json(items);
  },

  // GET /api/items/statistics
  async statistics(_req: Request, res: Response): Promise<void> {
    res.json(await itemService.statistics());
  },

  // GET /api/items/:id
  async getById(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    res.json(await itemService.getById(id));
  },

  // POST /api/items
  async create(req: Request, res: Response): Promise<void> {
    const dto = createItemSchema.parse(req.body ?? {});
    const created = await itemService.create(dto);
    res.status(201).json(created);
  },

  // PATCH /api/items/:id
  async update(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    const dto = updateItemSchema.parse(req.body ?? {});
    res.json(await itemService.update(id, dto));
  },

  // DELETE /api/items/:id
  async remove(req: Request, res: Response): Promise<void> {
    const { id } = idParamSchema.parse(req.params);
    await itemService.delete(id);
    res.status(204).send();
  },
};
