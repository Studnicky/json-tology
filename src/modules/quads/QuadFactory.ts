/**
 * QuadFactory — low-level quad construction primitives.
 *
 * Provides helpers for building RDF quad objects: iri(), literal(), bnode(),
 * rdfList(), quad(), annotationQuad(), and tripleTerm().
 *
 * Blank-node naming: callers SHOULD pass an IdentifierIssuerInterface for
 * concurrent-safe serializations. When no issuer is supplied, a module-level
 * counter is used (backward-compatible, not concurrent-safe).
 *
 * All quads are rdf/js-compliant: subject, predicate, and graph are
 * term objects (NamedNode | BlankNode | DefaultGraph),
 * not bare strings. Use `.value` to extract the IRI string.
 */

import type { Quad } from '@rdfjs/types';
import type { QuadInterface } from '../../interfaces/QuadInterface.js';
import type { QuadObjectType } from '../../types/Quad.js';
import { GraphError } from '../../errors/GraphError.js';
import { GRAPH_ERROR_CODE } from '../../constants/ERROR_CODES.js';
import type {
  QuadFactoryIriOptsType,
  QuadFactoryLiteralOptsType,
  QuadFactoryQuadOptsType
} from '../../types/QuadFactoryOpts.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { JsonLdDatasetQuadType } from '../../types/JsonLdDatasetQuadType.js';

import { Lists } from './Lists.js';
import { Terms } from './Terms.js';
import {
  RDF, XSD
} from '../../constants/IRI.js';

// ---------------------------------------------------------------------------
// Module-level fallback bnode counter — used when no issuer is supplied.
// ---------------------------------------------------------------------------

let bnodeCounter = 0;

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
    `Predicate is not an absolute IRI (unresolved CURIE prefix or relative reference): ${JSON.stringify(predicate)}`,
    { 'code': GRAPH_ERROR_CODE.INVALID_PREDICATE_IRI }
  );
}

// ---------------------------------------------------------------------------
// QuadFactory — static-only class
// ---------------------------------------------------------------------------

/**
 * Low-level quad construction primitives for RDF 1.1 and RDF 1.2.
 *
 * @remarks
 * All factory methods return rdf/js-compliant term objects — subjects,
 * predicates, and graphs are `NamedNode | BlankNode | DefaultGraph`,
 * never bare strings. Use `.value` to extract the underlying IRI string.
 *
 * Blank-node naming: callers should pass an `IdentifierIssuerInterface` for
 * concurrent-safe serializations. When no issuer is supplied, a module-level
 * counter is used (backward-compatible, not concurrent-safe across multiple
 * serialization calls).
 *
 * @example
 * ```ts
 * const q = QuadFactory.quad(
 *   'https://example.com/Subject',
 *   'https://example.com/predicate',
 *   QuadFactory.literal('hello', XSD.string),
 * );
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link Terms}
 * @group QuadFactory
 */
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
    options?: QuadFactoryQuadOptsType
  ): QuadInterface {
    const {
      curie, graph
    } = options ?? {};
    const expandedPredicate = curie ? curie.expandIfNeeded(annotationPredicate) : annotationPredicate;

    assertAbsolutePredicate(expandedPredicate);

    return Terms.quad(tripleTerm, Terms.iri(expandedPredicate), annotationValue, graph);
  }

  static bnode(id: string): QuadObjectType {
    const result = Terms.blank(id);

    return result;
  }

  /**
   * Construct a `QuadInterface` from a jsonld dataset quad object.
   */
  static fromDatasetQuad(datasetQuad: JsonLdDatasetQuadType): QuadInterface {
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
   * Group quads by subject value into a `Map<string, QuadInterface[]>`.
   *
   * Each key is `quad.subject.value` (an IRI string or blank-node identifier).
   * Insertion order within each bucket preserves the iteration order of `quads`.
   */
  static indexBySubject(quads: readonly QuadInterface[]): Map<string, QuadInterface[]> {
    const index = new Map<string, QuadInterface[]>();

    for (const quad of quads) {
      const key = quad.subject.value;
      let list = index.get(key);

      if (list === undefined) {
        list = [];
        index.set(key, list);
      }
      list.push(quad);
    }

    return index;
  }

  /**
   * Build an IRI term. When `options.curie` is provided, compact CURIEs
   * (`prefix:local`) are expanded against the shared `Curie` instance.
   */
  static iri(value: string, options?: QuadFactoryIriOptsType): QuadObjectType {
    const curie = options?.curie;
    const expandedValue = curie === undefined ? value : curie.expandIfNeeded(value);

    return Terms.iri(expandedValue);
  }

  /**
   * Build a typed literal term. `datatype` is expanded from compact CURIE
   * form when `options.curie` is provided.
   */
  static literal(value: unknown, datatype: string, options?: QuadFactoryLiteralOptsType): QuadObjectType {
    const curie = options?.curie;
    const language = options?.language;

    if (typeof language === 'string' && language !== '') {
      return Terms.literal(value, {
        'datatype': Terms.iri(RDF.langString),
        language
      });
    }

    const expandedDatatype = curie === undefined ? datatype : curie.expandIfNeeded(datatype);

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
    options?: QuadFactoryQuadOptsType
  ): QuadInterface {
    const {
      curie, graph
    } = options ?? {};
    const expandedPredicate = curie ? curie.expandIfNeeded(predicate) : predicate;
    const expandedSubject = curie ? curie.expandIfNeeded(subject) : subject;

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
    options?: QuadFactoryQuadOptsType
  ): Quad {
    const { curie } = options ?? {};
    const expandedPredicate = curie ? curie.expandIfNeeded(predicate) : predicate;
    const expandedSubject = curie ? curie.expandIfNeeded(subject) : subject;

    assertAbsolutePredicate(expandedPredicate);

    const subjectTerm = expandedSubject.startsWith('_:')
      ? Terms.blank(expandedSubject)
      : Terms.iri(expandedSubject);

    return Terms.tripleTerm(subjectTerm, Terms.iri(expandedPredicate), object);
  }
}
