// Service layer: business logic + mapping between persistence and DTOs.
// Translates repository/Prisma errors into domain errors (NotFound, etc.).
import { Item, Prisma } from '@prisma/client';
import { CreateItemDto, ItemResponseDto, UpdateItemDto } from '../dto/item.dto';
import { NotFoundError } from '../errors';
import { itemRepository } from '../repositories/item.repository';

function toDto(item: Item): ItemResponseDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// Prisma "record not found" error code.
function isNotFound(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025';
}

export interface StatisticsDto {
  totalItems: number;
  itemsWithDescription: number;
  itemsWithoutDescription: number;
  latestItem: ItemResponseDto | null;
}

export const itemService = {
  async list(): Promise<ItemResponseDto[]> {
    const items = await itemRepository.findAll();
    return items.map(toDto);
  },

  async getById(id: number): Promise<ItemResponseDto> {
    const item = await itemRepository.findById(id);
    if (!item) throw new NotFoundError(`item ${id} not found`);
    return toDto(item);
  },

  async search(q: string): Promise<ItemResponseDto[]> {
    const items = await itemRepository.search(q);
    return items.map(toDto);
  },

  async create(dto: CreateItemDto): Promise<ItemResponseDto> {
    const item = await itemRepository.create({
      name: dto.name,
      description: dto.description ?? null,
    });
    return toDto(item);
  },

  async update(id: number, dto: UpdateItemDto): Promise<ItemResponseDto> {
    try {
      const item = await itemRepository.update(id, {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
      });
      return toDto(item);
    } catch (err) {
      if (isNotFound(err)) throw new NotFoundError(`item ${id} not found`);
      throw err;
    }
  },

  async delete(id: number): Promise<void> {
    try {
      await itemRepository.delete(id);
    } catch (err) {
      if (isNotFound(err)) throw new NotFoundError(`item ${id} not found`);
      throw err;
    }
  },

  async statistics(): Promise<StatisticsDto> {
    const [total, withDesc, latest] = await Promise.all([
      itemRepository.count(),
      itemRepository.countWithDescription(),
      itemRepository.latest(),
    ]);
    return {
      totalItems: total,
      itemsWithDescription: withDesc,
      itemsWithoutDescription: total - withDesc,
      latestItem: latest ? toDto(latest) : null,
    };
  },
};
