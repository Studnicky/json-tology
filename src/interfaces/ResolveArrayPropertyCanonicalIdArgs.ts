import type { SchemaGraphInterface } from './SchemaGraphImpl.js';
import type { RelationIndexInterface } from './RelationIndex.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Arguments for resolveArrayPropertyCanonicalId. */
export interface ResolveArrayPropertyCanonicalIdArgsInterface {
  readonly 'graph': SchemaGraphInterface;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'propEntry': RelationIndexInterface;
  readonly 'propSubject': string;
}
