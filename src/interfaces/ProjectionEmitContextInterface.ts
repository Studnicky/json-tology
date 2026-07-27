/**
 * ProjectionEmitContext — shared emit context for OWL and SHACL quad projection.
 *
 * Bundles the curie, graph, relation index, identifier issuer, predicate resolver,
 * and quad accumulator passed through every projection-level emit helper.
 */

import type { CurieInterface } from './CurieInterface.js';
import type { IdentifierIssuerInterface } from './IdentifierIssuerInterface.js';
import type { PredicateResolverInterface } from './PredicateResolverInterface.js';
import type { QuadInterface } from './QuadInterface.js';
import type { RelationIndexInterface } from './RelationIndexInterface.js';
import type { SchemaGraphInterface } from './SchemaGraphInterface.js';

export interface ProjectionEmitContextInterface {
  'curie': CurieInterface | undefined;
  'graph': SchemaGraphInterface;
  'index': Map<string, RelationIndexInterface>;
  'issuer': IdentifierIssuerInterface | undefined;
  'predicateResolver': PredicateResolverInterface | undefined;
  'quads': QuadInterface[];
}
