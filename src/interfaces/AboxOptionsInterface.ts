import type { CurieInterface } from './CurieInterface.js';
import type { AnnotationEmitModeEntity } from '../entities/AnnotationEmitModeEntity.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { SkolemizeFunctionInterface } from './SkolemizeFunctionInterface.js';

/**
 * Shared ABox projection options: annotation emit mode, CURIE handler, base
 * graph IRI, IRI-minting strategy, and predicate resolver — every field
 * optional so callers only override what they need.
 */
export interface AboxOptionsInterface {
  'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
  'curie'?: CurieInterface | undefined;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFunctionInterface | undefined;
  'predicateResolver'?: PredicateResolverInterface | undefined;
}
