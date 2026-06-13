/**
 * ResolveListOptions — options for walking an RDF list and resolving each
 * member in the ClassExpressions dispatcher.
 */

import type { ClassExprResolveContextInterface } from './ClassExprResolveContext.js';

export interface ResolveListOptions extends ClassExprResolveContextInterface {
  'listHead': string;
}
