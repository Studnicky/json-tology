/**
 * ImportRelation — value-reading domain for OWL-import graph relations.
 *
 * Reads IRIs, lexical literals, and typed list items out of
 * `SchemaGraphRelationInterface` targets, and filters a subject's outgoing relations
 * by predicate. All methods are pure, stateless, and self-contained — nothing
 * here depends on orchestrator state or cross-dispatcher concerns.
 */

import type { ListItemEntity } from '../../../entities/ListItemEntity.js';
import type { SchemaGraphRelationInterface } from '../../../interfaces/SchemaGraphRelationInterface.js';
import type { SchemaGraphInterface } from '../../../interfaces/SchemaGraphInterface.js';
import type { OwlImportFragmentInterface } from '../../../interfaces/OwlImportFragmentInterface.js';
import type { JsonSchemaDocumentObjectType } from '../../../types/Schema.js';
import { Terms } from '../../quads/Terms.js';

export class ImportRelation {
  /**
   * Build an `OwlImportFragmentInterface` whose only populated bucket is
   * `schemaDeltas`; all registry-level buckets (characteristics, individuals,
   * sameAs, differentFrom, invariants) are empty arrays.
   *
   * Used by dispatchers that only ever emit structural schemaDeltas patches.
   */
  static buildFragment(schemaDeltas: Map<string, JsonSchemaDocumentObjectType>): OwlImportFragmentInterface {
    return {
      'characteristics': [],
      'differentFrom': [],
      'individuals': [],
      'invariants': [],
      'sameAs': [],
      schemaDeltas
    };
  }

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
  ): readonly SchemaGraphRelationInterface[] {
    const result = graph.relationsForSubject(subject).filter((rel: SchemaGraphRelationInterface): boolean => {
      const isMemberPredicate = predicates.has(rel.predicate);

      return isMemberPredicate;
    });

    return result;
  }

  /**
   * Walk an RDF list rooted at `listHead` and collect the IRIs of its
   * NamedNode members, skipping any BlankNode / Literal members.
   */
  static collectNamedNodeIris(graph: SchemaGraphInterface, listHead: string): string[] {
    const members: string[] = [];

    for (const item of graph.collectList(listHead)) {
      if (item.termType === 'NamedNode') {
        members.push(item.target);
      }
    }

    return members;
  }

  /**
   * Decode a Literal `ListItemEntity.Type` back to its typed JS value via the canonical
   * `Terms.literal` / `Terms.decodeLiteral` round-trip.
   *
   * Preserves XSD-typed integers, booleans, Dates, etc.
   */
  static decodeListItem(item: ListItemEntity.Type): unknown {
    const literalTerm = Terms.literal(item.target, {
      'datatype': Terms.iri(item.datatype ?? ''),
      'language': item.language ?? ''
    });

    return Terms.decodeLiteral(literalTerm);
  }

  /**
   * Return an empty `OwlImportFragmentInterface` — all arrays empty, schemaDeltas an
   * empty Map.
   *
   * Used as a fast-exit return value when a dispatcher finds nothing to process.
   */
  static emptyFragment(): OwlImportFragmentInterface {
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
  static literalString(relation: SchemaGraphRelationInterface): null | string {
    if (relation.termType !== 'Literal') {
      return null;
    }

    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }

  /**
   * Merge `patch` into the `schemaDeltas` entry for `subjectIri`, preserving
   * any fields already recorded by another axiom arm for the same subject.
   */
  static mergeSchemaDelta(
    schemaDeltas: Map<string, JsonSchemaDocumentObjectType>,
    subjectIri: string,
    patch: JsonSchemaDocumentObjectType
  ): void {
    const existing = schemaDeltas.get(subjectIri) ?? {};

    schemaDeltas.set(subjectIri, {
      ...existing,
      ...patch
    });
  }

  /**
   * Extract the IRI of a NamedNode-typed relation target.
   * Returns null when the relation does not carry a NamedNode target.
   */
  static namedNodeIri(relation: SchemaGraphRelationInterface): null | string {
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
  static targetValue(relation: SchemaGraphRelationInterface): string {
    return typeof relation.target === 'string' ? relation.target : relation.target.id;
  }
}
