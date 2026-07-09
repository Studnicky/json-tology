import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from './AnnotatedEdgeStructureType.js';
import type { PredicateResolverFnType } from './PredicateResolverFnType.js';

/** Arguments for emitFlatAnnotationQuads. */
export type EmitFlatAnnotationQuadsArgsType = {
  'annotationValues': Record<string, unknown>;
  'classId': string;
  'edge': AnnotatedEdgeStructureType;
  'instanceIri': string;
  'predicateResolver': PredicateResolverFnType;
  'quadOpts': QuadFactoryQuadOptsType;
  'quads': QuadInterface[];
};
