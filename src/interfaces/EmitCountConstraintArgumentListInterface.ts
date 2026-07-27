import type { SchemaGraphRelationInterface } from './SchemaGraphRelationInterface.js';
import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for emitCountConstraint. */
export interface EmitCountConstraintArgumentListInterface {
  'bnodeId': StringValueEntity.Type;
  'options': { 'curie': CurieInterface | undefined };
  'predicate': StringValueEntity.Type;
  'quads': QuadInterface[];
  'rels': SchemaGraphRelationInterface[];
}
