import type { PredicateValuesIndexInterface } from './PredicateValuesIndexInterface.js';
import type { PropertyShapeIndexInterface } from './PropertyShapeIndexInterface.js';
import type { BooleanValueEntity } from '../entities/BooleanValueEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** A parsed node shape. */
export interface NodeShapeIndexInterface {
  'constraints': PredicateValuesIndexInterface;
  'isDeactivated': BooleanValueEntity.Type;
  'propertyShapes': PropertyShapeIndexInterface[];
  'shapeIri': StringValueEntity.Type;
}
