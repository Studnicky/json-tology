import type { PredicateValuesIndexInterface } from './PredicateValuesIndexInterface.js';

/** Subject-to-predicate-to-object-value-strings index for quad lookup. */
export interface SubjectPredicateIndexInterface extends Map<string, PredicateValuesIndexInterface> {}
