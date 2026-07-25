import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { SchemaRegistryInterface } from '../interfaces/SchemaRegistryInterface.js';
import type { SubjectGroupType } from '../types/SubjectGroupType.js';
import type { PredicateResolverFunctionType } from '../types/PredicateResolverFunctionType.js';
import type { TripleTermIndexType } from '../types/TripleTermIndexType.js';
import type { IdentityType } from './IdentityType.js';

/** Shared lift execution context — avoids passing 5–9 args through recursive calls. */
export type LiftContextType = IdentityType<{
  'allGroups': SubjectGroupType;
  'curie': CurieInterface | undefined;
  'predicateResolver': PredicateResolverFunctionType | undefined;
  'registry': SchemaRegistryInterface;
  'tripleTermIndex': TripleTermIndexType;
}>;
