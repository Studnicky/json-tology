import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';

/** Arguments for emitCountConstraint. */
export type EmitCountConstraintArgsType = {
  'bnodeId': string;
  'opts': { 'curie': CurieInterface | undefined };
  'predicate': string;
  'quads': QuadInterface[];
  'rels': SchemaGraphRelationType[];
};
