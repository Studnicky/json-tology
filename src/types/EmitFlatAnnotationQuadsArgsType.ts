import type { QuadFactoryQuadOptionsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from './AnnotatedEdgeStructureType.js';
import type { PredicateResolverFunctionType } from './PredicateResolverFunctionType.js';

/** Arguments for emitFlatAnnotationQuads. */
export type EmitFlatAnnotationQuadsArgumentListType = {
  'annotationValues': Record<string, unknown>;
  'classId': string;
  'edge': AnnotatedEdgeStructureType;
  'instanceIri': string;
  'predicateResolver': PredicateResolverFunctionType;
  'quadOptions': QuadFactoryQuadOptionsType;
  'quads': QuadInterface[];
};
