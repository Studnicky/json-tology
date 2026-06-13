/**
 * ResolveBnodeOptions — options for resolving a blank-node class expression in
 * the ClassExpressions dispatcher.
 */

import type { ClassExprResolveContextInterface } from './ClassExprResolveContext.js';

export interface ResolveBnodeOptions extends ClassExprResolveContextInterface {
  'bnodeId': string;
}
