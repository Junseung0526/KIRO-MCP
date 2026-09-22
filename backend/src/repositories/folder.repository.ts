import { Folder } from '@prisma/client';
import { prisma } from '../prisma';

export const folderRepository = {
  list(): Promise<(Folder & { _count: { documents: number } })[]> {
    return prisma.folder.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { documents: true } } },
    });
  },

  findById(id: string): Promise<Folder | null> {
    return prisma.folder.findUnique({ where: { id } });
  },

  findByName(name: string): Promise<Folder | null> {
    return prisma.folder.findFirst({ where: { name } });
  },

  create(name: string): Promise<Folder> {
    return prisma.folder.create({ data: { name } });
  },

  rename(id: string, name: string): Promise<Folder> {
    return prisma.folder.update({ where: { id }, data: { name } });
  },

  delete(id: string): Promise<Folder> {
    // Documents' folderId is set to NULL automatically (onDelete: SetNull).
    return prisma.folder.delete({ where: { id } });
  },
};
