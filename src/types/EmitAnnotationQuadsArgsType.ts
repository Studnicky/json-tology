import type { Quad } from '@rdfjs/types';
import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';

/** Arguments for emitAnnotationQuads. */
export type EmitAnnotationQuadsArgsType = {
  'annotationValues': Record<string, unknown>;
  'classId': string;
  'edge': AnnotatedEdgeStructureType;
  'predicateResolver': PredicateResolverFnType;
  'quadOpts': QuadFactoryQuadOptsType;
  'quads': QuadInterface[];
  'tripleTerm': Quad;
};
