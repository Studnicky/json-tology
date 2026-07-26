import type { QuadOptionsInterface } from './QuadOptionsInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { AnnotatedEdgeStructureInterface } from './AnnotatedEdgeStructureInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { InstanceIriValueEntity } from '../entities/InstanceIriValueEntity.js';

/** Arguments for emitFlatAnnotationQuads. */
export interface EmitFlatAnnotationQuadsArgumentListInterface {
  'annotationValues': Record<string, unknown>;
  'classId': StringValueEntity.Type;
  'edge': AnnotatedEdgeStructureInterface;
  'instanceIri': InstanceIriValueEntity.Type;
  'predicateResolver': PredicateResolverInterface;
  'quadOptions': QuadOptionsInterface;
  'quads': QuadInterface[];
}
