import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { SchemaGraphRelationType } from './SchemaGraph.js';

/** Arguments for emitRangeConstraint. */
export type EmitRangeConstraintArgumentListType = {
  'bnodeId': string;
  'datatypeRels': SchemaGraphRelationType[];
  'options': { 'curie': CurieInterface | undefined };
  'quads': QuadInterface[];
  'rangeRels': SchemaGraphRelationType[];
};
