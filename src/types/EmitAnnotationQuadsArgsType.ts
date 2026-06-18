import type { Quad } from '@rdfjs/types';
import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';

/** Arguments for emitAnnotationQuads. */
export type EmitAnnotationQuadsArgsType = {
  readonly 'annotationValues': Record<string, unknown>;
  readonly 'classId': string;
  readonly 'edge': AnnotatedEdgeStructureType;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsType;
  readonly 'quads': QuadInterface[];
  readonly 'tripleTerm': Quad;
};
