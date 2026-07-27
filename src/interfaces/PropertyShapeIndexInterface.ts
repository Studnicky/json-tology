import type { PredicateValuesIndexInterface } from './PredicateValuesIndexInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** A parsed property shape. */
export interface PropertyShapeIndexInterface {
  'bnodeId': StringValueEntity.Type;
  'constraints': PredicateValuesIndexInterface;
  'isDeactivated': BooleanValueEntity.Type;
  'path': StringValueEntity.Type;
}
