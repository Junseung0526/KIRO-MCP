import { Router, Request, Response } from 'express';
import { prisma } from './prisma';

export const itemsRouter = Router();

// GET /api/items - list all items (newest first)
itemsRouter.get('/', async (_req: Request, res: Response) => {
  const items = await prisma.item.findMany({ orderBy: { id: 'desc' } });
  res.json(items);
});

// GET /api/items/:id - fetch one item
itemsRouter.get('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id must be an integer' });
  }
  const item = await prisma.item.findUnique({ where: { id } });
  if (!item) {
    return res.status(404).json({ error: 'item not found' });
  }
  res.json(item);
});

// POST /api/items - create an item
itemsRouter.post('/', async (req: Request, res: Response) => {
  const { name, description } = req.body ?? {};
  if (typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'name is required and must be a non-empty string' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be a string' });
  }
  const item = await prisma.item.create({
    data: { name: name.trim(), description: description ?? null },
  });
  res.status(201).json(item);
});

// PUT /api/items/:id - update an item
itemsRouter.put('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id must be an integer' });
  }
  const { name, description } = req.body ?? {};
  if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
    return res.status(400).json({ error: 'name must be a non-empty string' });
  }
  if (description !== undefined && description !== null && typeof description !== 'string') {
    return res.status(400).json({ error: 'description must be a string' });
  }
  try {
    const item = await prisma.item.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name: name.trim() } : {}),
        ...(description !== undefined ? { description } : {}),
      },
    });
    res.json(item);
  } catch {
    res.status(404).json({ error: 'item not found' });
  }
});

// DELETE /api/items/:id - delete an item
itemsRouter.delete('/:id', async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ error: 'id must be an integer' });
  }
  try {
    await prisma.item.delete({ where: { id } });
    res.status(204).send();
  } catch {
    res.status(404).json({ error: 'item not found' });
  }
});
