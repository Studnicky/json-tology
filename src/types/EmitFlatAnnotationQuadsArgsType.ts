import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from './AnnotatedEdgeStructureType.js';
import type { PredicateResolverFnType } from './PredicateResolverFnType.js';

/** Arguments for emitFlatAnnotationQuads. */
export type EmitFlatAnnotationQuadsArgsType = {
  readonly 'annotationValues': Record<string, unknown>;
  readonly 'classId': string;
  readonly 'edge': AnnotatedEdgeStructureType;
  readonly 'instanceIri': string;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsType;
  readonly 'quads': QuadInterface[];
};
