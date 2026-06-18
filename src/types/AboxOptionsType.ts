import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { PredicateResolverFnType } from './PredicateResolverFnType.js';
import type { SkolemizeFnType } from './SkolemizeFnType.js';

export type AboxOptionsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'curie'?: CurieInterface | undefined;
  readonly 'graphIri'?: string | undefined;
  readonly 'iriFor'?: SkolemizeFnType | undefined;
  readonly 'predicateResolver'?: PredicateResolverFnType | undefined;
};
