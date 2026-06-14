import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';
import type { RelationIndexType } from './RelationIndex.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';

/** Arguments for resolveArrayPropertyCanonicalId. */
export type ResolveArrayPropertyCanonicalIdArgsType = {
  readonly 'graph': SchemaGraphInterface;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'propEntry': RelationIndexType;
  readonly 'propSubject': string;
};
