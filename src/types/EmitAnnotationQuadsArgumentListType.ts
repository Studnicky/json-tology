import type { Quad } from '@rdfjs/types';
import type { QuadFactoryQuadOptionsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';

/** Arguments for emitAnnotationQuads. */
export type EmitAnnotationQuadsArgumentListType = {
  'annotationValues': Record<string, unknown>;
  'classId': string;
  'edge': AnnotatedEdgeStructureType;
  'predicateResolver': PredicateResolverFunctionType;
  'quadOptions': QuadFactoryQuadOptionsType;
  'quads': QuadInterface[];
  'tripleTerm': Quad;
};
