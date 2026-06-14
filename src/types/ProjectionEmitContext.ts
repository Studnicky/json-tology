/**
 * ProjectionEmitContext — shared emit context for OWL and SHACL quad projection.
 *
 * Bundles the curie, graph, relation index, identifier issuer, predicate resolver,
 * and quad accumulator passed through every projection-level emit helper.
 */

import type { CurieInterface } from '../interfaces/Curie.js';
import type { IdentifierIssuerInterface } from '../interfaces/IdentifierIssuer.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { QuadInterface } from '../interfaces/Quad.js';
import type { RelationIndexType } from './RelationIndex.js';
import type { SchemaGraphInterface } from '../interfaces/SchemaGraphImpl.js';

export type ProjectionEmitContextType = {
  readonly 'curie': CurieInterface | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'index': Map<string, RelationIndexType>;
  readonly 'issuer': IdentifierIssuerInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'quads': QuadInterface[];
};
