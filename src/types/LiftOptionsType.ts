/**
 * LiftOptionsType — optional inputs to `Lift.instances`.
 *
 * `curie` supplies prefix expansion so compact predicate IRIs in the quad
 * stream match the schema's resolved predicates; `predicateResolver` overrides
 * the default property → predicate IRI derivation during reverse projection.
 */

import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';

export type LiftOptionsType = {
  'curie'?: CurieInterface | undefined;
  'predicateResolver'?: PredicateResolverFnType | undefined;
};
