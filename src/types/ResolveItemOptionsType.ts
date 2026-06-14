/**
 * ResolveItemOptionsType — options for resolving a list item into a JSON Schema
 * fragment in the ClassExpressions dispatcher.
 */

import type { ListItemType } from './SchemaGraph.js';
import type { ClassExprResolveContextType } from './ClassExprResolveContext.js';

export type ResolveItemOptionsType = ClassExprResolveContextType & {
  'item': ListItemType;
};
