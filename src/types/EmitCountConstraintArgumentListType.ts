import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';

/** Arguments for emitCountConstraint. */
export type EmitCountConstraintArgumentListType = {
  'bnodeId': string;
  'options': { 'curie': CurieInterface | undefined };
  'predicate': string;
  'quads': QuadInterface[];
  'rels': SchemaGraphRelationType[];
};
