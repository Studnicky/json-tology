import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { PredicateIndexType } from '../types/PredicateIndexType.js';

/** Arguments for finding quads matching a schema property predicate. */
export type FindPropertyQuadsArgsType = {
  readonly 'index': PredicateIndexType | undefined;
  readonly 'predicateIri': string;
  readonly 'propName': string;
  readonly 'subjectQuads': QuadInterface[];
};
