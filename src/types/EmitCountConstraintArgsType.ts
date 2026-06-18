import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';

/** Arguments for emitCountConstraint. */
export type EmitCountConstraintArgsType = {
  readonly 'bnodeId': string;
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'predicate': string;
  readonly 'quads': QuadInterface[];
  readonly 'rels': readonly SchemaGraphRelationType[];
};
