import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistryInterface.js';
import type { SubjectGroupType } from '../types/SubjectGroupType.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';

/** Shared lift execution context — avoids passing 5–9 args through recursive calls. */
export type LiftContextType = {
  'allGroups': SubjectGroupType;
  'curie': CurieInterface | undefined;
  'predicateResolver': PredicateResolverFnType | undefined;
  'registry': SchemaRegistryInterface;
  'tripleTermIndex': TripleTermIndexType;
};
