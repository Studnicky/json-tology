import type { CurieInterface } from './Curie.js';
import type { IriMinterInterface } from './Projection.js';
import type { QuadFactoryQuadOptsInterface } from './QuadFactoryOpts.js';
import type { QuadInterface } from './Quad.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../types/Quad.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Arguments for projectAnnotatedEdge. */
export interface ProjectAnnotatedEdgeArgsInterface {
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'graphTerm': DefaultGraphTermType | IriTermType;
  readonly 'instanceIri': string;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsInterface;
  readonly 'quads': QuadInterface[];
  readonly 'sourceId': string;
  readonly 'value': unknown;
}
