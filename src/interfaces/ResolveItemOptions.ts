/**
 * ResolveItemOptions — options for resolving a list item into a JSON Schema
 * fragment in the ClassExpressions dispatcher.
 */

import type { ListItemType } from './SchemaGraph.js';
import type { ClassExprResolveContextInterface } from './ClassExprResolveContext.js';

export interface ResolveItemOptions extends ClassExprResolveContextInterface {
  'item': ListItemType;
}
