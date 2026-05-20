/**
 * QuadFactory — low-level quad construction primitives.
 *
 * Owns blank-node counter state and provides helpers for building
 * RDF quad objects: iri(), literal(), bnode(), rdfList(), quad(),
 * and the shared emitLiterals() helper used by OWL/SHACL projections.
 *
 * All quads are rdf/js-compliant: subject, predicate, and graph are
 * term objects (IriTermType | BnodeTermType | DefaultGraphTermType),
 * not bare strings. Use `.value` to extract the IRI string.
 */

import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';
import { Lists } from './Lists.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import { Terms } from './Terms.js';
import { XSD } from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// jsonld dataset quad shape — the object shape emitted by jsonld.toRDF()
// ---------------------------------------------------------------------------

interface DatasetTerm {
  'termType': string;
  'value': string;
}

interface DatasetLiteralTerm extends DatasetTerm {
  'datatype'?: DatasetTerm;
  'language'?: string;
}

export interface JsonLdDatasetQuad {
  'graph': DatasetTerm;
  'object': DatasetLiteralTerm;
  'predicate': DatasetTerm;
  'subject': DatasetTerm;
}

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
    return Terms.blank(id);
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

  /**
   * Construct a `QuadInterface` from a jsonld dataset quad object.
   *
   * jsonld.toRDF() returns rdf/js-compatible term shapes. This method
   * maps those shapes to the project's `Terms`-backed rdf/js quad.
   *
   * Blank-node handling: blank-node values from jsonld include the `_:` prefix
   * in their `.value`; `Terms.blank` preserves that value as-is.
   *
   * Literal handling: datatype is preserved via the datatype NamedNode value.
   * Language tags are carried through via `Terms.literal({ language })`.
   */
  static fromDatasetQuad(datasetQuad: JsonLdDatasetQuad): QuadInterface {
    const subject = datasetQuad.subject.termType === 'BlankNode'
      ? Terms.blank(datasetQuad.subject.value)
      : Terms.iri(datasetQuad.subject.value);

    const predicate = Terms.iri(datasetQuad.predicate.value);

    let object: QuadObjectType;
    const obj = datasetQuad.object;

    if (obj.termType === 'BlankNode') {
      object = Terms.blank(obj.value);
    } else if (obj.termType === 'Literal') {
      const datatypeIri = obj.datatype?.value ?? XSD.string;
      const language = obj.language ?? '';

      object = Terms.literal(obj.value, {
        'datatype': Terms.iri(datatypeIri),
        language
      });
    } else {
      object = Terms.iri(obj.value);
    }

    let graph;

    if (datasetQuad.graph.termType === 'DefaultGraph') {
      graph = Terms.defaultGraph();
    } else if (datasetQuad.graph.termType === 'BlankNode') {
      graph = Terms.blank(datasetQuad.graph.value);
    } else {
      graph = Terms.iri(datasetQuad.graph.value);
    }

    return Terms.quad(subject, predicate, object, graph);
  }

  static iri(value: string, options?: { 'curie'?: CurieInterface | undefined }): QuadObjectType {
    const { curie } = options ?? {};
    const expandedValue = curie ? expandCurieIfNeeded(value, curie) : value;

    return Terms.iri(expandedValue);
  }

  static literal(value: unknown, datatype: string, options?: { 'curie'?: CurieInterface | undefined }): QuadObjectType {
    const { curie } = options ?? {};
    const expandedDatatype = curie ? expandCurieIfNeeded(datatype, curie) : datatype;

    return Terms.literal(value, { 'datatype': Terms.iri(expandedDatatype) });
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
    const expandedSubject = curie ? expandCurieIfNeeded(subject, curie) : subject;

    const subjectTerm = expandedSubject.startsWith('_:')
      ? Terms.blank(expandedSubject)
      : Terms.iri(expandedSubject);

    return Terms.quad(subjectTerm, Terms.iri(expandedPredicate), object);
  }

  /**
   * Construct an RDF list and push its `rdf:first` / `rdf:rest` triples to
   * `quads`. Returns the list head (a `BlankNode` for non-empty lists, or
   * `rdf:nil` for empty lists) to be used as the object position in the
   * parent triple.
   *
   * Standard RDF list encoding — no project-internal `List` term. Every
   * quad produced is a spec-compliant `@rdfjs/types#Quad`.
   */
  static rdfList(items: QuadObjectType[], quads: QuadInterface[]): QuadObjectType {
    const {
      head, triples
    } = Lists.build(items);

    for (const triple of triples) {
      quads.push(triple);
    }

    return head;
  }

  static resetBnodeCounter(): void {
    bnodeCounter = 0;
  }
}
