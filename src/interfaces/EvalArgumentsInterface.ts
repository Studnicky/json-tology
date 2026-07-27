import type { StringArrayEntity } from '../entities/StringArrayEntity.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { DatatypeIndexInterface } from './DatatypeIndexInterface.js';
import type { PredicateValuesIndexInterface } from './PredicateValuesIndexInterface.js';
import type { SubjectPredicateIndexInterface } from './SubjectPredicateIndexInterface.js';
import type { TypeIndexInterface } from './TypeIndexInterface.js';

/** Arguments shared across all constraint evaluators. */
export interface EvalArgumentsInterface {
  'constraints': PredicateValuesIndexInterface;
  'dataIndex': SubjectPredicateIndexInterface;
  'datatypeBySubjectPredicate': DatatypeIndexInterface;
  'dataTypeIndex': TypeIndexInterface;
  'focusNode': StringValueEntity.Type;
  'path': StringValueEntity.Type;
  'shapeId': StringValueEntity.Type;
  'shapeIndex': SubjectPredicateIndexInterface;
  'valueCount': NumberValueEntity.Type;
  'values': StringArrayEntity.Type;
}
