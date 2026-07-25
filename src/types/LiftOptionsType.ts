/**
 * LiftOptionsType — optional inputs to `Lift.instances`.
 *
 * `curie` supplies prefix expansion so compact predicate IRIs in the quad
 * stream match the schema's resolved predicates; `predicateResolver` overrides
 * the default property → predicate IRI derivation during reverse projection.
 */

import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';
import type { IdentityType } from './IdentityType.js';

export type LiftOptionsType = IdentityType<{
  'curie'?: CurieInterface | undefined;
  'predicateResolver'?: PredicateResolverFunctionType | undefined;
}>;
