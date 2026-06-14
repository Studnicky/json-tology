import type { CurieInterface } from '../interfaces/Curie.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';

/** Arguments for emitCountConstraint. */
export type EmitCountConstraintArgsType = {
  readonly 'bnodeId': string;
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'predicate': string;
  readonly 'quads': QuadInterface[];
  readonly 'rels': readonly SchemaGraphRelationType[];
};
