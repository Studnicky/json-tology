import type { PredicateValuesIndexInterface } from './PredicateValuesIndexInterface.js';

/** Datatype IRI of each literal object per subject+predicate, for data quads. */
export interface DatatypeIndexInterface extends Map<string, PredicateValuesIndexInterface> {}
