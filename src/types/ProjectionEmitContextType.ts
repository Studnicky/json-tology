/**
 * ProjectionEmitContext — shared emit context for OWL and SHACL quad projection.
 *
 * Bundles the curie, graph, relation index, identifier issuer, predicate resolver,
 * and quad accumulator passed through every projection-level emit helper.
 */

import type { CurieInterface } from '../interfaces/CurieInterface.js';
import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuerInterface.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFnType.js';
import type { QuadInterface } from '../interfaces/QuadInterface.js';
import type { RelationIndexType } from './RelationIndexType.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphInterface.js';

export type ProjectionEmitContextType = {
  readonly 'curie': CurieInterface | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'index': Map<string, RelationIndexType>;
  readonly 'issuer': IdentifierIssuerInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'quads': QuadInterface[];
};
