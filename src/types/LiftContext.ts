import type { CurieInterface } from '../interfaces/Curie.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistry.js';
import type { SubjectGroupType } from '../types/SubjectGroup.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';

/** Shared lift execution context — avoids passing 5–9 args through recursive calls. */
export type LiftContextType = {
  readonly 'allGroups': SubjectGroupType;
  readonly 'curie': CurieInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'registry': SchemaRegistryInterface;
  readonly 'tripleTermIndex': TripleTermIndexType;
};
