import type { QuadInterface } from '../interfaces/QuadInterface.js';

/** Map from predicate IRI to matching quads — built when the subject has many properties. */
export type PredicateIndexType = Map<string, QuadInterface[]>;
