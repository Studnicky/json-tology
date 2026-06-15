import type { CurieInterface } from '../interfaces/Curie.js';
import type { AnnotationEmitModeType } from './AnnotationEmitMode.js';
import type { PredicateResolverFnType } from './PredicateResolverFn.js';
import type { SkolemizeFnType } from './Skolemize.js';

export type AboxOptionsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'graphIRI'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
};
