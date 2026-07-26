/**
 * ResolveItemOptionsInterface — options for resolving a list item into a JSON Schema
 * fragment in the ClassExpressions dispatcher.
 */

import type { ListItemEntity } from '../entities/ListItemEntity.js';
import type { ClassExprResolveContextInterface } from './ClassExprResolveContextInterface.js';

export interface ResolveItemOptionsInterface extends ClassExprResolveContextInterface {
  'item': ListItemEntity.Type;
}
