import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';

/** Arguments for lifting an annotated edge back to its JS representation. */
export type LiftAnnotatedEdgeArgumentListType = {
  'classId': string;
  'curie': CurieInterface | undefined;
  'edge': AnnotatedEdgeStructureType;
  'predicateResolver': PredicateResolverFunctionType | undefined;
  'subjectIri': string;
  'subjectQuads': QuadInterface[];
  'tripleTermIndex': TripleTermIndexType;
};
