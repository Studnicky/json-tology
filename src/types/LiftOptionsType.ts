/**
 * LiftOptionsType — optional inputs to `Lift.instances`.
 *
 * `curie` supplies prefix expansion so compact predicate IRIs in the quad
 * stream match the schema's resolved predicates; `predicateResolver` overrides
 * the default property → predicate IRI derivation during reverse projection.
 */

import type { CurieInterface } from '../interfaces/Curie.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

export type LiftOptionsType = {
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
};
