/**
 * DispatchHelpers — shared primitive helpers for OWL import dispatch modules.
 *
 * All exports are pure, stateless utilities used across two or more dispatcher
 * modules. Nothing here depends on orchestrator state or cross-dispatcher
 * concerns; each function has a single, self-evident responsibility.
 */

import type {
  ListItemType,
  SchemaGraphRelationType
} from '../../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphImpl.js';
import type { OwlImportFragmentType } from '../../../types/OwlImport.js';
import { Terms } from '../../rdf/Terms.js';
import { decodeLiteral } from '../../rdf/Terms.js';

// ---------------------------------------------------------------------------
// targetValue
// ---------------------------------------------------------------------------

/**
 * Resolve the IRI / bnode-id / lexical form of a relation target.
 *
 * Both string-shaped targets (compact / full IRI, lexical literal) and
 * node-shaped targets (carrying an `.id` property) are accepted.
 */
export function targetValue(relation: SchemaGraphRelationType): string {
  return typeof relation.target === 'string' ? relation.target : relation.target.id;
}

// ---------------------------------------------------------------------------
// relationsByPredicate
// ---------------------------------------------------------------------------

/**
 * Filter outgoing relations on a subject by predicate membership set.
 *
 * Delegates to `graph.relationsForSubject` and keeps only relations whose
 * `.predicate` is a member of `predicates`.
 */
export function relationsByPredicate(
  graph: SchemaGraphInterface,
  subject: string,
  predicates: ReadonlySet<string>
): readonly SchemaGraphRelationType[] {
  return graph.relationsForSubject(subject).filter((rel: SchemaGraphRelationType): boolean => {
    return predicates.has(rel.predicate);
  });
}

// ---------------------------------------------------------------------------
// decodeListItemLiteral
// ---------------------------------------------------------------------------

/**
 * Decode a Literal `ListItemType` back to its typed JS value via the canonical
 * `Terms.literal` / `decodeLiteral` round-trip.
 *
 * Preserves XSD-typed integers, booleans, Dates, etc.
 */
export function decodeListItemLiteral(item: ListItemType): unknown {
  const literalTerm = Terms.literal(item.target, {
    'datatype': Terms.iri(item.datatype ?? ''),
    'language': item.language ?? ''
  });

  return decodeLiteral(literalTerm);
}

// ---------------------------------------------------------------------------
// emptyFragment
// ---------------------------------------------------------------------------

/**
 * Return an empty `OwlImportFragmentType` — all arrays empty, schemaDeltas an
 * empty Map.
 *
 * Used as a fast-exit return value when a dispatcher finds nothing to process.
 */
export function emptyFragment(): OwlImportFragmentType {
  return {
    'characteristics': [],
    'differentFrom': [],
    'individuals': [],
    'invariants': [],
    'sameAs': [],
    'schemaDeltas': new Map()
  };
}
