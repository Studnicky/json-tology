import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { QuadFactoryQuadOptsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type {
  DefaultGraphTermType, IriTermType
} from '../types/Quad.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';

/** Arguments for projectAnnotatedEdge. */
export type ProjectAnnotatedEdgeArgsType = {
  readonly 'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  readonly 'curie': CurieInterface | undefined;
  readonly 'depth': number;
  readonly 'edge': AnnotatedEdgeStructureType;
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
