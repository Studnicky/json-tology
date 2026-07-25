import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { IriMinterInterface } from '../interfaces/IriMinterInterface.js';
import type { AnnotationEmitModeType } from './AnnotationEmitModeType.js';
import type { QuadFactoryQuadOptionsType } from './QuadFactoryOpts.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';

/** Arguments for projectAnnotatedEdge. */
export type ProjectAnnotatedEdgeArgumentListType = {
  'annotationEmitMode'?: AnnotationEmitModeType | undefined;
  'curie': CurieInterface | undefined;
  'depth': number;
  'edge': AnnotatedEdgeStructureType;
  'graphTerm': DefaultGraph | NamedNode;
  'instanceIri': string;
  'minter': IriMinterInterface;
  'path': string;
  'predicateResolver': PredicateResolverFunctionType;
  'quadOptions': QuadFactoryQuadOptionsType;
  'quads': QuadInterface[];
  'sourceId': string;
  'value': unknown;
};
