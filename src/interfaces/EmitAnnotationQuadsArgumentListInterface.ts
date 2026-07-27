import type { Quad } from '@rdfjs/types';
import type { QuadOptionsInterface } from './QuadOptionsInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { AnnotatedEdgeStructureInterface } from './AnnotatedEdgeStructureInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';

/** Arguments for emitAnnotationQuads. */
export interface EmitAnnotationQuadsArgumentListInterface {
  'annotationValues': Record<string, unknown>;
  'classId': StringValueEntity.Type;
  'edge': AnnotatedEdgeStructureInterface;
  'predicateResolver': PredicateResolverInterface;
  'quadOptions': QuadOptionsInterface;
  'quads': QuadInterface[];
  'tripleTerm': Quad;
}
