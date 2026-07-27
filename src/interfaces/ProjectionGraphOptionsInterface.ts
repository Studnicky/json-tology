import type { CurieInterface } from './CurieInterface.js';
import type { IdentifierIssuerInterface } from './IdentifierIssuerInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';

/** Options accepted by `OwlProjection.graph()` and `ShaclProjection.graph()`. */
export interface ProjectionGraphOptionsInterface {
  'curie'?: CurieInterface | undefined;
  'issuer'?: IdentifierIssuerInterface | undefined;
  'predicateResolver'?: PredicateResolverInterface | undefined;
}
