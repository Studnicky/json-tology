import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type { SchemaGraphRelationInterface } from './SchemaGraph.js';

/** Arguments for emitRangeConstraint. */
export interface EmitRangeConstraintArgsInterface {
  readonly 'bnodeId': string;
  readonly 'datatypeRels': readonly SchemaGraphRelationInterface[];
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'quads': QuadInterface[];
  readonly 'rangeRels': readonly SchemaGraphRelationInterface[];
}
