import type { CurieInterface } from '../interfaces/Curie.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { AnnotatedEdgeStructure } from '../types/AnnotatedEdgeStructure.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';

/** Arguments for lifting an annotated edge back to its JS representation. */
export type LiftAnnotatedEdgeArgsType = {
  readonly 'classId': string;
  readonly 'curie': CurieInterface | undefined;
  readonly 'edge': AnnotatedEdgeStructure;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'subjectIri': string;
  readonly 'subjectQuads': QuadInterface[];
  readonly 'tripleTermIndex': TripleTermIndexType;
};
