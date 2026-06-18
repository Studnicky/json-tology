import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';

/** Arguments for emitRangeConstraint. */
export type EmitRangeConstraintArgsType = {
  readonly 'bnodeId': string;
  readonly 'datatypeRels': readonly SchemaGraphRelationType[];
  readonly 'opts': { 'curie': CurieInterface | undefined };
  readonly 'quads': QuadInterface[];
  readonly 'rangeRels': readonly SchemaGraphRelationType[];
};
