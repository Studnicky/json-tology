/**
 * ResolveListOptionsType — options for walking an RDF list and resolving each
 * member in the ClassExpressions dispatcher.
 */

import type { ClassExprResolveContextType } from './ClassExprResolveContext.js';

export type ResolveListOptionsType = ClassExprResolveContextType & {
  'listHead': string;
};
