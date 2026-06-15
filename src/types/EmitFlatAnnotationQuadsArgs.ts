import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { AnnotatedEdgeStructure } from './AnnotatedEdgeStructure.js';
import type { PredicateResolverFnType } from './PredicateResolverFn.js';

/** Arguments for emitFlatAnnotationQuads. */
export type EmitFlatAnnotationQuadsArgsType = {
  readonly 'annotationValues': Record<string, unknown>;
  readonly 'classId': string;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'instanceIri': string;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsType;
  readonly 'quads': QuadInterface[];
};
