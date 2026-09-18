// Repository layer: the ONLY place that talks to Prisma/PostgreSQL for Items.
// No raw/arbitrary SQL — only typed Prisma queries.
import { Item, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export interface CreateItemData {
  name: string;
  description?: string | null;
}

export interface UpdateItemData {
  name?: string;
  description?: string | null;
}

export const itemRepository = {
  findAll(): Promise<Item[]> {
    return prisma.item.findMany({ orderBy: { id: 'desc' } });
  },

  findById(id: number): Promise<Item | null> {
    return prisma.item.findUnique({ where: { id } });
  },

  // Case-insensitive search across name + description.
  search(q: string): Promise<Item[]> {
    const where: Prisma.ItemWhereInput = {
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ],
    };
    return prisma.item.findMany({ where, orderBy: { id: 'desc' } });
  },

  create(data: CreateItemData): Promise<Item> {
    return prisma.item.create({
      data: { name: data.name, description: data.description ?? null },
    });
  },

  update(id: number, data: UpdateItemData): Promise<Item> {
    return prisma.item.update({ where: { id }, data });
  },

  delete(id: number): Promise<Item> {
    return prisma.item.delete({ where: { id } });
  },

  count(): Promise<number> {
    return prisma.item.count();
  },

  countWithDescription(): Promise<number> {
    return prisma.item.count({ where: { NOT: { description: null } } });
  },

  latest(): Promise<Item | null> {
    return prisma.item.findFirst({ orderBy: { createdAt: 'desc' } });
  },
};
