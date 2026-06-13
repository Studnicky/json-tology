/**
 * ProjectionEmitContext — shared emit context for OWL and SHACL quad projection.
 *
 * Bundles the curie, graph, relation index, identifier issuer, predicate resolver,
 * and quad accumulator passed through every projection-level emit helper.
 */

import type { CurieInterface } from './Curie.js';
import type { IdentifierIssuerInterface } from './IdentifierIssuer.js';
import type { PredicateResolverFnType } from '../types/PredicateResolverFn.js';
import type { QuadInterface } from './Quad.js';
import type { RelationIndexInterface } from './RelationIndex.js';
import type { SchemaGraphInterface } from './SchemaGraphImpl.js';

export interface ProjectionEmitContextInterface {
  readonly 'curie': CurieInterface | undefined;
  readonly 'graph': SchemaGraphInterface;
  readonly 'index': Map<string, RelationIndexInterface>;
  readonly 'issuer': IdentifierIssuerInterface | undefined;
  readonly 'predicateResolver': PredicateResolverFnType | undefined;
  readonly 'quads': QuadInterface[];
}
