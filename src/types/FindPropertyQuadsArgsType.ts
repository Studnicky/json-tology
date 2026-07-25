import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';

/** Arguments for finding quads matching a schema property predicate. */
export type FindPropertyQuadsArgumentListType = {
  'index': PredicateIndexType | undefined;
  'predicateIri': string;
  'propName': string;
  'subjectQuads': QuadInterface[];
};
