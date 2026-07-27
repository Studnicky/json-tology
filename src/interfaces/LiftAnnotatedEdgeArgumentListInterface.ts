import type { CurieInterface } from './CurieInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { AnnotatedEdgeStructureInterface } from './AnnotatedEdgeStructureInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { StringValueEntity } from '../entities/StringValueEntity.js';
import type { TripleTermIndexInterface } from './TripleTermIndexInterface.js';

/** Arguments for lifting an annotated edge back to its JS representation. */
export interface LiftAnnotatedEdgeArgumentListInterface {
  'classId': StringValueEntity.Type;
  'curie': CurieInterface | undefined;
  'edge': AnnotatedEdgeStructureInterface;
  'predicateResolver': PredicateResolverInterface | undefined;
  'subjectIri': StringValueEntity.Type;
  'subjectQuads': QuadInterface[];
  'tripleTermIndex': TripleTermIndexInterface;
}
