// FolderService: subject/course folders. Deleting a folder keeps its documents
// (they become uncategorized). Names must be unique and non-empty.
import { BadRequestError, NotFoundError } from '../errors';
import { logger } from '../logger';
import { folderRepository } from '../repositories/folder.repository';

export interface FolderDto {
  id: string;
  name: string;
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export const folderService = {
  async list(): Promise<FolderDto[]> {
    const rows = await folderRepository.list();
    return rows.map((f) => ({
      id: f.id, name: f.name, documentCount: f._count.documents,
      createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString(),
    }));
  },

  async create(name: string): Promise<FolderDto> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestError('폴더 이름을 입력해주세요.');
    if (await folderRepository.findByName(trimmed)) throw new BadRequestError('같은 이름의 폴더가 이미 있습니다.');
    const f = await folderRepository.create(trimmed);
    await logger.info('folder.create', 'folder created');
    return { id: f.id, name: f.name, documentCount: 0, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() };
  },

  async rename(id: string, name: string): Promise<FolderDto> {
    const trimmed = name.trim();
    if (!trimmed) throw new BadRequestError('폴더 이름을 입력해주세요.');
    if (!(await folderRepository.findById(id))) throw new NotFoundError('폴더를 찾을 수 없습니다.');
    const dup = await folderRepository.findByName(trimmed);
    if (dup && dup.id !== id) throw new BadRequestError('같은 이름의 폴더가 이미 있습니다.');
    const f = await folderRepository.rename(id, trimmed);
    return { id: f.id, name: f.name, documentCount: 0, createdAt: f.createdAt.toISOString(), updatedAt: f.updatedAt.toISOString() };
  },

  async delete(id: string): Promise<void> {
    if (!(await folderRepository.findById(id))) throw new NotFoundError('폴더를 찾을 수 없습니다.');
    await folderRepository.delete(id);
    await logger.info('folder.delete', 'folder deleted (documents kept, uncategorized)');
  },

  async assertExists(id: string): Promise<void> {
    if (!(await folderRepository.findById(id))) throw new BadRequestError('대상 폴더가 존재하지 않습니다.');
  },
};
