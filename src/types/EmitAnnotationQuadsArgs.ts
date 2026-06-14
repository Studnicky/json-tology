import type { Quad } from '@rdfjs/types';
import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Arguments for emitAnnotationQuads. */
export type EmitAnnotationQuadsArgsType = {
  readonly 'annotationValues': Record<string, unknown>;
  readonly 'classId': string;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsType;
  readonly 'quads': QuadInterface[];
  readonly 'tripleTerm': Quad;
};
