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
import { relationTargetId } from './ProjectionIndex.js';
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
    curie?: CurieInterface
  ): void {
    const rels = entry.byPredicate.get(predicate);

    if (rels !== undefined) {
      for (const rel of rels) {
        const litVal = QuadFactory.literal(relationTargetId(rel), XSD.string, curie);

        quads.push(QuadFactory.quad(subject, outputPredicate, litVal, curie));
      }
    }
  }

  static iri(value: string, curie?: CurieInterface): QuadObjectType {
    const expandedValue = curie ? expandCurieIfNeeded(value, curie) : value;

    return {
      'termType': 'NamedNode',
      'value': expandedValue
    };
  }

  static literal(value: unknown, datatype: string, curie?: CurieInterface): QuadObjectType {
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
    curie?: CurieInterface
  ): QuadInterface {
    const expandedPredicate = curie ? expandCurieIfNeeded(predicate, curie) : predicate;

    return {
      object,
      'predicate': expandedPredicate,
      subject
    };
  }

  static rdfList(items: QuadObjectType[], _?: CurieInterface): QuadObjectType {
    return {
      items,
      'termType': 'List'
    };
  }

  static resetBnodeCounter(): void {
    bnodeCounter = 0;
  }
}
