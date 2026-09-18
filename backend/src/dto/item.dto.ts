// DTOs + validation schemas for the Item resource.
// Validation is centralized here with zod and reused by controllers.
import { z } from 'zod';

// Body for POST /api/items
export const createItemSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200, 'name too long'),
  description: z.string().trim().max(2000, 'description too long').nullable().optional(),
});

// Body for PATCH /api/items/:id — all fields optional, but at least one required.
export const updateItemSchema = z
  .object({
    name: z.string().trim().min(1, 'name must not be empty').max(200, 'name too long').optional(),
    description: z.string().trim().max(2000, 'description too long').nullable().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'at least one field (name or description) must be provided',
  });

// Route param :id
export const idParamSchema = z.object({
  id: z.coerce.number().int('id must be an integer').positive('id must be positive'),
});

// Query for GET /api/items and GET /api/items/search
export const listQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
});

export type CreateItemDto = z.infer<typeof createItemSchema>;
export type UpdateItemDto = z.infer<typeof updateItemSchema>;

// Shape returned to clients (keeps API response explicit/stable).
export interface ItemResponseDto {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}
