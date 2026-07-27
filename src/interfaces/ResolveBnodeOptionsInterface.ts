/**
 * ResolveBnodeOptionsInterface — options for resolving a blank-node class expression in
 * the ClassExpressions dispatcher.
 */

import type { ClassExprResolveContextInterface } from './ClassExprResolveContextInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

export interface ResolveBnodeOptionsInterface extends ClassExprResolveContextInterface {
  'bnodeId': StringValueEntity.Type;
}
