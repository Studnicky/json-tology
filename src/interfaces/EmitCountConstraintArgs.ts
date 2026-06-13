import type { CurieInterface } from './Curie.js';
import type { QuadInterface } from './Quad.js';
import type { SchemaGraphRelationInterface } from './SchemaGraph.js';

/** Arguments for emitCountConstraint. */
export interface EmitCountConstraintArgsInterface {
  readonly 'bnodeId': string;
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'predicate': string;
  readonly 'quads': QuadInterface[];
  readonly 'rels': readonly SchemaGraphRelationInterface[];
}
