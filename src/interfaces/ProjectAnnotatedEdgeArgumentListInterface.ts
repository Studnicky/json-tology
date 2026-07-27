import type { CurieInterface } from './CurieInterface.js';
import type { IriMinterInterface } from './IriMinterInterface.js';
import type { AnnotationEmitModeEntity } from '../entities/AnnotationEmitModeEntity.js';
import type { QuadOptionsInterface } from './QuadOptionsInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { AnnotatedEdgeStructureInterface } from './AnnotatedEdgeStructureInterface.js';
import type {
  DefaultGraph, NamedNode
} from '@rdfjs/types';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { NumberValueEntity } from '../entities/NumberValueEntity.js';
import type { InstanceIriValueEntity } from '../entities/InstanceIriValueEntity.js';
import type { PathValueEntity } from '../entities/PathValueEntity.js';
import type { IriEntity } from '../entities/IriEntity.js';

/** Arguments for projectAnnotatedEdge. */
export interface ProjectAnnotatedEdgeArgumentListInterface {
  'annotationEmitMode'?: AnnotationEmitModeEntity.Type | undefined;
  'curie': CurieInterface | undefined;
  'depth': NumberValueEntity.Type;
  'edge': AnnotatedEdgeStructureInterface;
  'graphTerm': DefaultGraph | NamedNode;
  'instanceIri': InstanceIriValueEntity.Type;
  'minter': IriMinterInterface;
  'path': PathValueEntity.Type;
  'predicateResolver': PredicateResolverInterface;
  'quadOptions': QuadOptionsInterface;
  'quads': QuadInterface[];
  'sourceId': IriEntity.Type;
  'value': unknown;
}
