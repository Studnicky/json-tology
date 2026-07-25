import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { PredicateResolverFunctionType } from './PredicateResolverFunctionType.js';
import type { SkolemizeFunctionType } from './SkolemizeFunctionType.js';

export type AboxOptionsType = Partial<{
  'annotationEmitMode': AnnotationEmitModeType | undefined;
  'curie': CurieInterface | undefined;
  'graphIri': string | undefined;
  'iriFor': SkolemizeFunctionType | undefined;
  'predicateResolver': PredicateResolverFunctionType | undefined;
}>;
