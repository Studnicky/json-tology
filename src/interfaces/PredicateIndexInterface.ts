import type { QuadInterface } from './QuadInterface.js';

/** Map from predicate IRI to matching quads — built when the subject has many properties. */
export interface PredicateIndexInterface extends Map<string, QuadInterface[]> {}
