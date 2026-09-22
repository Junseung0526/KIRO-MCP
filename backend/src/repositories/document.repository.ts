// Repository: the only place that runs Prisma queries for documents.
import { Document, Prisma } from '@prisma/client';
import { prisma } from '../prisma';

export type SortKey = 'recent' | 'oldest' | 'name' | 'size' | 'viewed';

export const documentRepository = {
  create(data: Prisma.DocumentCreateInput): Promise<Document> {
    return prisma.document.create({ data });
  },

  findById(id: string): Promise<Document | null> {
    return prisma.document.findUnique({ where: { id } });
  },

  async list(opts: { q?: string; category?: string; sort?: SortKey; folderId?: string | null }): Promise<Document[]> {
    const where: Prisma.DocumentWhereInput = {};
    if (opts.q) where.originalName = { contains: opts.q, mode: 'insensitive' };
    if (opts.category && opts.category !== 'all') where.category = opts.category;
    // folderId: undefined = all folders; null = uncategorized only; string = that folder.
    if (opts.folderId === null) where.folderId = null;
    else if (typeof opts.folderId === 'string') where.folderId = opts.folderId;

    const orderBy: Prisma.DocumentOrderByWithRelationInput =
      opts.sort === 'oldest' ? { uploadedAt: 'asc' }
      : opts.sort === 'name' ? { originalName: 'asc' }
      : opts.sort === 'size' ? { sizeBytes: 'desc' }
      : opts.sort === 'viewed' ? { lastViewedAt: 'desc' }
      : { uploadedAt: 'desc' };

    return prisma.document.findMany({ where, orderBy });
  },

  move(id: string, folderId: string | null): Promise<Document> {
    return prisma.document.update({ where: { id }, data: { folderId } });
  },

  recentlyViewed(limit = 5): Promise<Document[]> {
    return prisma.document.findMany({
      where: { lastViewedAt: { not: null } },
      orderBy: { lastViewedAt: 'desc' },
      take: limit,
    });
  },

  delete(id: string): Promise<Document> {
    return prisma.document.delete({ where: { id } });
  },

  touchView(id: string, page?: number): Promise<Document> {
    return prisma.document.update({
      where: { id },
      data: { lastViewedAt: new Date(), ...(page !== undefined ? { lastViewedPage: page } : {}) },
    });
  },

  count(): Promise<number> {
    return prisma.document.count();
  },

  countByCategory(): Promise<Record<string, number>> {
    return prisma.document.groupBy({ by: ['category'], _count: true }).then((rows) =>
      Object.fromEntries(rows.map((r) => [r.category, r._count])),
    );
  },

  totalSize(): Promise<number> {
    return prisma.document.aggregate({ _sum: { sizeBytes: true } }).then((r) => r._sum.sizeBytes ?? 0);
  },
};
