import type { CurieInterface } from '../interfaces/Curie.js';
import type { IriMinterInterface } from '../interfaces/Projection.js';
import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../types/Quad.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Arguments for projectAnnotatedEdge. */
export type ProjectAnnotatedEdgeArgsType = {
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'graphTerm': DefaultGraphTermType | IriTermType;
  readonly 'instanceIri': string;
  readonly 'minter': IriMinterInterface;
  readonly 'path': string;
  readonly 'predicateResolver': PredicateResolverFnType;
  readonly 'quadOpts': QuadFactoryQuadOptsType;
  readonly 'quads': QuadInterface[];
  readonly 'sourceId': string;
  readonly 'value': unknown;
};
