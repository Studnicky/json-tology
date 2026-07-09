import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { PredicateResolverFnType } from './PredicateResolverFnType.js';
import type { SkolemizeFnType } from './SkolemizeFnType.js';

export type AboxOptionsType = {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'curie'?: CurieInterface | undefined;
  'graphIri'?: string | undefined;
  'iriFor'?: SkolemizeFnType | undefined;
  'predicateResolver'?: PredicateResolverFnType | undefined;
};
