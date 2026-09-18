import { Router } from 'express';
import { itemController } from '../controllers/item.controller';
import { asyncHandler } from '../errors';

export const itemRouter = Router();

// Static/specific routes MUST be registered before the dynamic ":id" route,
// otherwise "search"/"statistics" would be captured as an id.
itemRouter.get('/search', asyncHandler(itemController.search));
itemRouter.get('/statistics', asyncHandler(itemController.statistics));

itemRouter.get('/', asyncHandler(itemController.list));
itemRouter.post('/', asyncHandler(itemController.create));

itemRouter.get('/:id', asyncHandler(itemController.getById));
itemRouter.patch('/:id', asyncHandler(itemController.update));
itemRouter.delete('/:id', asyncHandler(itemController.remove));
