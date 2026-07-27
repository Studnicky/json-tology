/**
 * LiftOptionsInterface — optional inputs to `Lift.instances`.
 *
 * `curie` supplies prefix expansion so compact predicate IRIs in the quad
 * stream match the schema's resolved predicates; `predicateResolver` overrides
 * the default property → predicate IRI derivation during reverse projection.
 */

import type { CurieInterface } from './CurieInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';

export interface LiftOptionsInterface {
  'curie'?: CurieInterface | undefined;
  'predicateResolver'?: PredicateResolverInterface | undefined;
}
