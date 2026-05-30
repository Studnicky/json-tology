/**
 * QuadFactory — low-level quad construction primitives.
 *
 * Provides helpers for building RDF quad objects: iri(), literal(), bnode(),
 * rdfList(), quad(), and the shared emitLiterals() helper used by OWL/SHACL
 * projections.
 *
 * Blank-node naming: callers SHOULD pass an IdentifierIssuerInterface for
 * concurrent-safe serializations. When no issuer is supplied, a module-level
 * counter is used (backward-compatible, not concurrent-safe).
 *
 * All quads are rdf/js-compliant: subject, predicate, and graph are
 * term objects (IriTermType | BnodeTermType | DefaultGraphTermType),
 * not bare strings. Use `.value` to extract the IRI string.
 */

import type { Quad } from '@rdfjs/types';
import type { QuadInterface } from '../../interfaces/Quad.js';
import type { QuadObjectType } from '../../types/Quad.js';
import type { CurieInterface } from '../../interfaces/Curie.js';
import { GraphError } from '../../errors/GraphError.js';
import type {
  QuadFactoryEmitOptsInterface,
  QuadFactoryIriOptsInterface,
  QuadFactoryLiteralOptsInterface,
  QuadFactoryQuadOptsInterface
} from '../../interfaces/QuadFactoryOpts.js';
import type { RelationIndexInterface } from '../../interfaces/RelationIndex.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import { Lists } from './Lists.js';
import { ProjectionIndex } from './ProjectionIndex.js';
import { Terms } from './Terms.js';
import {
  RDF, XSD
} from '../../constants/IRI.js';

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
// Module-level fallback bnode counter — used when no issuer is supplied.
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

/**
 * Validate that a finalized predicate IRI is absolute. A predicate that is
 * still a compact CURIE (`prefix:local` with an unregistered prefix) after
 * expansion would otherwise be emitted as an invalid IRI. Absolute forms
 * recognised: `://` (with a non-empty scheme) or a `urn:` namespace.
 *
 * Predicates may never be blank nodes, so a `_:` value is also rejected.
 */
function assertAbsolutePredicate(predicate: string): void {
  if (predicate.indexOf('://') > 0 || predicate.startsWith('urn:')) {
    return;
  }

  throw new GraphError(
    'INVALID_PREDICATE_IRI',
    `Predicate is not an absolute IRI (unresolved CURIE prefix or relative reference): ${JSON.stringify(predicate)}`
  );
}

// ---------------------------------------------------------------------------
// QuadFactory — static-only class
// ---------------------------------------------------------------------------

export class QuadFactory {
  /**
   * Construct an annotation quad whose subject is an RDF 1.2 triple term.
   *
   * Emits `<< s p o >> annotationPredicate annotationValue` stamped with the
   * supplied `graph`. The inner triple term is built via {@link QuadFactory.tripleTerm}.
   */
  static annotationQuad(
    tripleTerm: Quad,
    annotationPredicate: string,
    annotationValue: QuadObjectType,
    options?: QuadFactoryQuadOptsInterface
  ): QuadInterface {
    const {
      curie, graph
    } = options ?? {};
    const expandedPredicate = curie ? expandCurieIfNeeded(annotationPredicate, curie) : annotationPredicate;

    assertAbsolutePredicate(expandedPredicate);

    return Terms.quad(tripleTerm, Terms.iri(expandedPredicate), annotationValue, graph);
  }

  static bnode(id: string): QuadObjectType {
    return Terms.blank(id);
  }

  /**
   * Emit a single numeric constraint literal for the first relation matching a predicate.
   */
  static emitConstraintLiteral(
    subject: string,
    entry: RelationIndexInterface,
    predicate: string,
    datatype: string,
    quads: QuadInterface[],
    options?: QuadFactoryEmitOptsInterface
  ): void {
    const rels = entry.byPredicate.get(predicate) ?? [];

    if (rels.length > 0) {
      const curie = options?.curie;
      const numLit = QuadFactory.literal(Number(ProjectionIndex.relationTargetId(rels[0])), datatype, { curie });

      quads.push(QuadFactory.quad(subject, predicate, numLit, { curie }));
    }
  }

  /**
   * Emit string literal quads for all relations matching a predicate.
   */
  static emitLiterals(
    subject: string,
    entry: RelationIndexInterface,
    predicate: string,
    outputPredicate: string,
    quads: QuadInterface[],
    options?: QuadFactoryEmitOptsInterface
  ): void {
    const rels = entry.byPredicate.get(predicate);

    if (rels !== undefined) {
      const curie = options?.curie;

      for (const rel of rels) {
        const litVal = QuadFactory.literal(ProjectionIndex.relationTargetId(rel), XSD.string, { curie });

        quads.push(QuadFactory.quad(subject, outputPredicate, litVal, { curie }));
      }
    }
  }

  /**
   * Construct a `QuadInterface` from a jsonld dataset quad object.
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

  /**
   * Build an IRI term. When `options.curie` is provided, compact CURIEs
   * (`prefix:local`) are expanded against the shared `Curie` instance.
   */
  static iri(value: string, options?: QuadFactoryIriOptsInterface): QuadObjectType {
    const curie = options?.curie;
    const expandedValue = curie === undefined ? value : expandCurieIfNeeded(value, curie);

    return Terms.iri(expandedValue);
  }

  /**
   * Build a typed literal term. `datatype` is expanded from compact CURIE
   * form when `options.curie` is provided.
   */
  static literal(value: unknown, datatype: string, options?: QuadFactoryLiteralOptsInterface): QuadObjectType {
    const curie = options?.curie;
    const language = options?.language;

    if (typeof language === 'string' && language !== '') {
      return Terms.literal(value, {
        'datatype': Terms.iri(RDF.langString),
        language
      });
    }

    const expandedDatatype = curie === undefined ? datatype : expandCurieIfNeeded(datatype, curie);

    return Terms.literal(value, { 'datatype': Terms.iri(expandedDatatype) });
  }

  /**
   * Issue the next blank node identifier.
   *
   * When `issuer` is provided, uses the per-call issuer's counter (concurrent-safe).
   * When omitted, falls back to a module-level counter (backward-compatible,
   * not concurrent-safe across multiple serialization calls).
   *
   * IMPORTANT: If you call OwlProjection.graph() / ShaclProjection.graph() multiple
   * times in the same serialization batch (e.g., in BaseGraphSerializer.serializeQuads),
   * either pass the SAME issuer to all calls, OR call resetBnodeCounter() before
   * the batch to avoid bnode ID collisions.
   */
  static nextBnode(issuerOrUndefined?: IdentifierIssuerInterface): string {
    if (issuerOrUndefined !== undefined) {
      return issuerOrUndefined.getId();
    }

    return `_:b${bnodeCounter++}`;
  }

  /**
   * Construct a `QuadInterface` from string subject/predicate plus an already-
   * built object term.
   *
   * The fourth parameter accepts an options bag `{ curie?, graph? }`.
   * Wave 2 H-4 signature: `QuadFactory.quad(s, p, o, { graph: graphTerm })`.
   */
  static quad(
    subject: string,
    predicate: string,
    object: QuadObjectType,
    options?: QuadFactoryQuadOptsInterface
  ): QuadInterface {
    const {
      curie, graph
    } = options ?? {};
    const expandedPredicate = curie ? expandCurieIfNeeded(predicate, curie) : predicate;
    const expandedSubject = curie ? expandCurieIfNeeded(subject, curie) : subject;

    assertAbsolutePredicate(expandedPredicate);

    const subjectTerm = expandedSubject.startsWith('_:')
      ? Terms.blank(expandedSubject)
      : Terms.iri(expandedSubject);

    return Terms.quad(subjectTerm, Terms.iri(expandedPredicate), object, graph);
  }

  /**
   * Construct an RDF list and push its triples into `quads`.
   * Returns the list head.
   *
   * @param items - Term objects to encode as an RDF list.
   * @param quads - Output array to push list triples into.
   * @param issuer - Optional per-call identifier issuer.
   */
  static rdfList(
    items: QuadObjectType[],
    quads: QuadInterface[],
    issuer?: IdentifierIssuerInterface
  ): QuadObjectType {
    const {
      head, triples
    } = Lists.build(items, issuer);

    for (const triple of triples) {
      quads.push(triple);
    }

    return head;
  }

  /**
   * Reset the module-level bnode counter. Call before a serialization batch
   * that involves multiple OwlProjection.graph() / ShaclProjection.graph() calls
   * (when not using an IdentifierIssuer).
   */
  static resetBnodeCounter(): void {
    bnodeCounter = 0;
  }

  /**
   * Build an RDF 1.2 triple term (quoted triple) from string subject/predicate
   * plus an already-built object term. The returned `Quad` carries
   * `termType: 'Quad'` and is intended for use as the subject of an annotation
   * quad (see {@link QuadFactory.annotationQuad}).
   *
   * A triple term is a value with no graph membership — its `graph` is the
   * default-graph singleton. Graph membership is carried by the outer
   * annotation quad.
   */
  static tripleTerm(
    subject: string,
    predicate: string,
    object: QuadObjectType,
    options?: QuadFactoryQuadOptsInterface
  ): Quad {
    const { curie } = options ?? {};
    const expandedPredicate = curie ? expandCurieIfNeeded(predicate, curie) : predicate;
    const expandedSubject = curie ? expandCurieIfNeeded(subject, curie) : subject;

    assertAbsolutePredicate(expandedPredicate);

    const subjectTerm = expandedSubject.startsWith('_:')
      ? Terms.blank(expandedSubject)
      : Terms.iri(expandedSubject);

    return Terms.tripleTerm(subjectTerm, Terms.iri(expandedPredicate), object);
  }
}
