/**
 * ResolveBnodeOptionsType — options for resolving a blank-node class expression in
 * the ClassExpressions dispatcher.
 */

import type { ClassExprResolveContextType } from './ClassExprResolveContextType.js';

export type ResolveBnodeOptionsType = ClassExprResolveContextType & {
  'bnodeId': string;
};
