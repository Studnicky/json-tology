import type { CurieInterface } from './Curie.js';
import type { SchemaRegistryInterface } from './SchemaRegistry.js';
import type { SubjectGroupType } from '../types/SubjectGroup.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';

/** Shared lift execution context — avoids passing 5–9 args through recursive calls. */
export interface LiftContextInterface {
  readonly 'allGroups': SubjectGroupType;
  readonly 'curie': CurieInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'registry': SchemaRegistryInterface;
  readonly 'tripleTermIndex': TripleTermIndexType;
}
