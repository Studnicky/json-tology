import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';
import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for emitRangeConstraint. */
export interface EmitRangeConstraintArgumentListInterface {
  'bnodeId': StringValueEntity.Type;
  'datatypeRels': SchemaGraphRelationInterface[];
  'options': { 'curie': CurieInterface | undefined };
  'quads': QuadInterface[];
  'rangeRels': SchemaGraphRelationInterface[];
}
