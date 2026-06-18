import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { AnnotatedEdgeStructureType } from '../types/AnnotatedEdgeStructureType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';

/** Arguments for lifting an annotated edge back to its JS representation. */
export type LiftAnnotatedEdgeArgsType = {
  readonly 'classId': string;
  readonly 'curie': CurieInterface | undefined;
  readonly 'edge': AnnotatedEdgeStructureType;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'subjectIri': string;
  readonly 'subjectQuads': QuadInterface[];
  readonly 'tripleTermIndex': TripleTermIndexType;
};
