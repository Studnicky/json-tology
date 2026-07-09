/**
 * ImportRelation — value-reading domain for OWL-import graph relations.
 *
 * Reads IRIs, lexical literals, and typed list items out of
 * `SchemaGraphRelationType` targets, and filters a subject's outgoing relations
 * by predicate. All methods are pure, stateless, and self-contained — nothing
 * here depends on orchestrator state or cross-dispatcher concerns.
 */

import type {
  ListItemType,
  SchemaGraphRelationType
} from '../../../types/SchemaGraph.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphInterface.js';
import type { OwlImportFragmentType } from '../../../types/OwlImport.js';
import { Terms } from '../../quads/Terms.js';

export class ImportRelation {
  /**
   * Filter outgoing relations on a subject by predicate membership set.
   *
   * Delegates to `graph.relationsForSubject` and keeps only relations whose
   * `.predicate` is a member of `predicates`.
   */
  static byPredicate(
    graph: SchemaGraphInterface,
    subject: string,
    predicates: ReadonlySet<string>
  ): readonly SchemaGraphRelationType[] {
    const result = graph.relationsForSubject(subject).filter((rel: SchemaGraphRelationType): boolean => {
      const isMemberPredicate = predicates.has(rel.predicate);

      return isMemberPredicate;
    });

    return result;
  }

  /**
   * Decode a Literal `ListItemType` back to its typed JS value via the canonical
   * `Terms.literal` / `Terms.decodeLiteral` round-trip.
   *
   * Preserves XSD-typed integers, booleans, Dates, etc.
   */
  static decodeListItem(item: ListItemType): unknown {
    const literalTerm = Terms.literal(item.target, {
      'datatype': Terms.iri(item.datatype ?? ''),
      'language': item.language ?? ''
    });

    return Terms.decodeLiteral(literalTerm);
  }

  /**
   * Return an empty `OwlImportFragmentType` — all arrays empty, schemaDeltas an
   * empty Map.
   *
   * Used as a fast-exit return value when a dispatcher finds nothing to process.
   */
  static emptyFragment(): OwlImportFragmentType {
    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      'schemaDeltas': new Map()
    };
  }

  /**
   * Extract the string value of a Literal-typed relation target.
   * Returns null when the relation does not carry a Literal target.
   */
  static literalString(relation: SchemaGraphRelationType): null | string {
    if (relation.termType !== 'Literal') {
      return null;
    }

    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }

  /**
   * Extract the IRI of a NamedNode-typed relation target.
   * Returns null when the relation does not carry a NamedNode target.
   */
  static namedNodeIri(relation: SchemaGraphRelationType): null | string {
    if (relation.termType !== 'NamedNode') {
      return null;
    }

    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }

  /**
   * Resolve the IRI / bnode-id / lexical form of a relation target.
   *
   * Both string-shaped targets (compact / full IRI, lexical literal) and
   * node-shaped targets (carrying an `.id` property) are accepted.
   */
  static targetValue(relation: SchemaGraphRelationType): string {
    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }
}
