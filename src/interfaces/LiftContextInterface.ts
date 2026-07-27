import type { CurieInterface } from './CurieInterface.js';
import type { SchemaRegistryInterface } from './SchemaRegistryInterface.js';
import type { SubjectGroupInterface } from './SubjectGroupInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { TripleTermIndexInterface } from './TripleTermIndexInterface.js';

/** Shared lift execution context — avoids passing 5–9 args through recursive calls. */
export interface LiftContextInterface {
  'allGroups': SubjectGroupInterface;
  'curie': CurieInterface | undefined;
  'predicateResolver': PredicateResolverInterface | undefined;
  'registry': SchemaRegistryInterface;
  'tripleTermIndex': TripleTermIndexInterface;
}
