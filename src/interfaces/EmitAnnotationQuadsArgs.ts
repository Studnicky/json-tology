import type { Quad } from '@rdfjs/types';
import type { QuadFactoryQuadOptsInterface } from './QuadFactoryOpts.js';
import type { QuadInterface } from './Quad.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Arguments for emitAnnotationQuads. */
export interface EmitAnnotationQuadsArgsInterface {
  readonly 'annotationValues': Record<string, unknown>;
  readonly 'classId': string;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsInterface;
  readonly 'quads': QuadInterface[];
  readonly 'tripleTerm': Quad;
}
