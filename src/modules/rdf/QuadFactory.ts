/**
 * QuadFactory — low-level quad construction primitives.
 *
 * Owns blank-node counter state and provides helpers for building
 * RDF quad objects: iri(), literal(), bnode(), rdfList(), quad(),
 * and the shared emitLiterals() helper used by OWL/SHACL projections.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import { XSD } from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Blank node counter
// ---------------------------------------------------------------------------

let bnodeCounter = 0;

// ---------------------------------------------------------------------------
// CURIE expansion helper
// ---------------------------------------------------------------------------

/**
 * Safely expand CURIE strings (prefix:local) to full IRIs.
 * Passes through full IRIs unchanged. Blank nodes unchanged.
 */
function expandCurieIfNeeded(value: string, curie: CurieInterface): string {
  // Blank nodes pass through unchanged
  if (value.startsWith('_:')) {
    return value;
  }
  // Full IRIs pass through unchanged
  if (value.startsWith('http://') || value.startsWith('https://') || value.startsWith('urn:')) {
    return value;
  }
  // Try to expand as CURIE (prefix:local format)
  try {
    return curie.expand(value);
  } catch {
    // If expansion fails, return the value as-is (may be a fragment or local reference)
    return value;
  }
}

// ---------------------------------------------------------------------------
// QuadFactory — static-only class
// ---------------------------------------------------------------------------

export class QuadFactory {
  static bnode(id: string): QuadObjectType {
    return {
      'termType': 'BlankNode',
      'value': id
    };
  }

  /**
   * Emit a single numeric constraint literal for the first relation matching a predicate.
   *
   * Looks up `entry.byPredicate.get(predicate)`, coerces the first target to
   * a number, and pushes one quad with the given datatype.
   */
  static emitConstraintLiteral(
    subject: string,
    entry: RelationIndexInterface,
    predicate: string,
    datatype: string,
    quads: QuadInterface[],
    options?: { 'curie'?: CurieInterface | undefined }
  ): void {
    const { curie } = options ?? {};
    const rels = entry.byPredicate.get(predicate) ?? [];

    if (rels.length > 0) {
      const numLit = QuadFactory.literal(Number(ProjectionIndex.relationTargetId(rels[0])), datatype, { curie });

      quads.push(QuadFactory.quad(subject, predicate, numLit, { curie }));
    }
  }

  /**
   * Emit string literal quads for all relations matching a predicate.
   *
   * Iterates `entry.byPredicate.get(predicate)` and pushes one quad per
   * relation with the target value as an xsd:string literal.
   */
  static emitLiterals(
    subject: string,
    entry: RelationIndexInterface,
    predicate: string,
    outputPredicate: string,
    quads: QuadInterface[],
    options?: { 'curie'?: CurieInterface | undefined }
  ): void {
    const { curie } = options ?? {};
    const rels = entry.byPredicate.get(predicate);

    if (rels !== undefined) {
      for (const rel of rels) {
        const litVal = QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, { curie });

        quads.push(QuadFactory.quad(subject, outputPredicate, litVal, { curie }));
      }
    }
  }

  static iri(value: string, options?: { 'curie'?: CurieInterface | undefined }): QuadObjectType {
    const { curie } = options ?? {};
    const expandedValue = curie ? expandCurieIfNeeded(value, curie) : value;

    return {
      'termType': 'NamedNode',
      'value': expandedValue
    };
  }

  static literal(value: unknown, datatype: string, options?: { 'curie'?: CurieInterface | undefined }): QuadObjectType {
    const { curie } = options ?? {};
    const expandedDatatype = curie ? expandCurieIfNeeded(datatype, curie) : datatype;

    return {
      'datatype': {
        'termType': 'NamedNode' as const,
        'value': expandedDatatype
      },
      'language': '',
      'termType': 'Literal',
      value
    };
  }

  static nextBnode(): string {
    return `_:b${bnodeCounter++}`;
  }

  static quad(
    subject: string,
    predicate: string,
    object: QuadObjectType,
    options?: { 'curie'?: CurieInterface | undefined }
  ): QuadInterface {
    const { curie } = options ?? {};
    const expandedPredicate = curie ? expandCurieIfNeeded(predicate, curie) : predicate;

    return {
      object,
      'predicate': expandedPredicate,
      subject
    };
  }

  static rdfList(items: QuadObjectType[]): QuadObjectType {
    return {
      items,
      'termType': 'List'
    };
  }

  static resetBnodeCounter(): void {
    bnodeCounter = 0;
  }
}
