/**
 * Lists — build a standard RDF list triple sequence from a flat item array.
 *
 * The encoding is the canonical RDF list shape:
 *   _:b0 rdf:first item0 .
 *   _:b0 rdf:rest  _:b1 .
 *   ...
 *   _:bN rdf:rest  rdf:nil .
 */

import type {
  BlankNode, NamedNode, Quad
} from '@rdfjs/types';
import type { QuadObjectType } from '../../types/Quad.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { ListBuildResultInterface } from '../../interfaces/ListBuildResultInterface.js';
import type { CollectStepResultInterface } from '../../interfaces/CollectStepResultInterface.js';
import { RDF } from '../../constants/IRI.js';
import { Terms } from './Terms.js';
import { RdfTermKindEntity } from '../../entities/RdfTermKindEntity.js';
import { GraphTermKindEntity } from '../../entities/GraphTermKindEntity.js';
import { ResourceTermKindEntity } from '../../entities/ResourceTermKindEntity.js';
import { NamedNodeKindEntity } from '../../entities/NamedNodeKindEntity.js';

/**
 * RDF list utilities — build, traverse, and filter standard rdf:first/rdf:rest chains.
 *
 * @remarks
 * Encodes the canonical RDF list shape using rdf:first / rdf:rest / rdf:nil triple sequences.
 * All methods operate on rdf/js-compatible Quad objects and project-native QuadObjectType terms.
 *
 * @example
 * ```ts
 * const { head, triples } = Lists.build([Terms.iri(XSD.string)], issuer);
 * const items = Lists.collect(head, allQuads);
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link Lists.build}
 * @group Lists
 * @defaultValue Static-method-only namespace class — use the static methods directly.
 */
export class Lists {
  // Module-level fallback counter — used when no issuer is supplied.
  private static listBnodeCounter = 0;

  /**
   * Narrow a raw rdf/js `Quad['object']` term to the project `QuadObjectType`.
   *
   * @remarks
   * Returns `undefined` for term types that are not valid quad object positions
   * in the project's RDF model (e.g. `DefaultGraph`, `Quad` triple-terms in
   * object position).
   *
   * @example
   * ```ts
   * const narrowed = Lists.asQuadObject(quad.object);
   * if (narrowed !== undefined) { ... }
   * ```
   *
   * @param rawObject - The raw rdf/js term from `Quad['object']`.
   * @returns The narrowed QuadObjectType, or undefined if not a valid object term.
   *
   * @category RDF
   * @since 0.1.0
   * @see {@link Lists.narrowExternalQuads}
   * @group Lists
   */
  static asQuadObject(rawObject: Quad['object']): QuadObjectType | undefined {
    if (RdfTermKindEntity.validate(rawObject.termType)) {
      return rawObject as QuadObjectType;
    }

    return undefined;
  }

  /**
   * Build the RDF list encoding for `items`.
   *
   * @remarks
   * Produces the canonical rdf:first / rdf:rest / rdf:nil triple chain
   * encoding for the given item array. For an empty array, returns
   * `rdf:nil` as the head with no triples.
   *
   * @example
   * ```ts
   * const { head, triples } = Lists.build([Terms.iri(XSD.string)], issuer);
   * ```
   *
   * @param items - Term objects to encode as an RDF list.
   * @param issuer - Optional per-call identifier issuer. When omitted, falls
   *   back to a module-level counter (not concurrent-safe).
   * @returns An object with `head` (the first bnode or rdf:nil) and `triples`.
   *
   * @category RDF
   * @since 0.1.0
   * @see {@link Lists.collect}
   * @group Lists
   */
  static build(
    items: readonly QuadObjectType[],
    issuer?: IdentifierIssuerInterface
  ): ListBuildResultInterface {
    if (items.length === 0) {
      return {
        'head': Terms.iri(RDF.nil),
        'triples': []
      };
    }

    const triples: Quad[] = [];
    const head = Lists.nextListBnodeWithFallback(issuer);
    let current: BlankNode = head;
    const itemsLength = items.length;

    for (let i = 0; i < itemsLength; i++) {
      const item = items[i];

      if (item === undefined) {
        continue;
      }

      triples.push(Terms.quad(current, Terms.iri(RDF.first), item));

      if (i < itemsLength - 1) {
        const next = Lists.nextListBnodeWithFallback(issuer);

        triples.push(Terms.quad(current, Terms.iri(RDF.rest), next));
        current = next;
      } else {
        triples.push(Terms.quad(current, Terms.iri(RDF.rest), Terms.iri(RDF.nil)));
      }
    }

    return {
      head,
      triples
    };
  }

  /**
   * Collect all items from an RDF list starting at `head`.
   *
   * @remarks
   * Traverses rdf:first / rdf:rest chains within `allQuads` and returns the
   * object terms in order. Stops at rdf:nil, when a rest object is not a
   * NamedNode or BlankNode, or when a cycle is detected via the seen-set.
   *
   * @example
   * ```ts
   * const items = Lists.collect(listHead, quads);
   * ```
   *
   * @param head - The first node in the RDF list (NamedNode or BlankNode).
   * @param allQuads - The full quad set to search within.
   * @returns Ordered array of QuadObjectType items extracted from the list.
   *
   * @category RDF
   * @since 0.1.0
   * @see {@link Lists.build}
   * @group Lists
   */
  static collect(
    head: BlankNode | NamedNode,
    allQuads: readonly Quad[]
  ): QuadObjectType[] {
    if (head.termType === 'NamedNode' && Lists.isRdfNil(head.value)) {
      return [];
    }

    const items: QuadObjectType[] = [];
    const seen = new Set<string>();
    let current: BlankNode | NamedNode = head;

    while (!seen.has(`${current.termType}:${current.value}`)) {
      seen.add(`${current.termType}:${current.value}`);

      const step = Lists.collectStep(current, allQuads);

      if (step.item !== undefined) {
        items.push(step.item);
      }

      if (step.done || step.next === undefined) {
        break;
      }

      current = step.next;
    }

    return items;
  }

  private static collectStep(
    cursor: BlankNode | NamedNode,
    allQuads: readonly Quad[]
  ): CollectStepResultInterface {
    const firstQuad = allQuads.find((quad: Quad): boolean => {
      const result = Lists.isFirstTriple(quad, cursor);

      return result;
    });

    if (firstQuad === undefined) {
      return {
        'done': true,
        'item': undefined,
        'next': undefined
      };
    }

    const item: QuadObjectType | undefined = RdfTermKindEntity.validate(firstQuad.object.termType)
      ? firstQuad.object as QuadObjectType
      : undefined;

    const restQuad = allQuads.find((quad: Quad): boolean => {
      const result = Lists.isRestTriple(quad, cursor);

      return result;
    });

    if (restQuad === undefined) {
      return {
        'done': true,
        item,
        'next': undefined
      };
    }

    const rest = restQuad.object;

    if (rest.termType === 'NamedNode' && Lists.isRdfNil(rest.value)) {
      return {
        'done': true,
        item,
        'next': undefined
      };
    }

    if (rest.termType !== 'NamedNode' && rest.termType !== 'BlankNode') {
      return {
        'done': true,
        item,
        'next': undefined
      };
    }

    return {
      'done': false,
      item,
      'next': rest
    };
  }

  private static isFirstTriple(quad: Quad, cursor: BlankNode | NamedNode): boolean {
    return quad.subject.equals(cursor) && Lists.isRdfFirst(quad.predicate.value);
  }

  static isRdfFirst(value: string): boolean {
    return value === RDF.first;
  }

  static isRdfNil(value: string): boolean {
    return value === RDF.nil;
  }

  static isRdfRest(value: string): boolean {
    return value === RDF.rest;
  }

  private static isRestTriple(quad: Quad, cursor: BlankNode | NamedNode): boolean {
    return quad.subject.equals(cursor) && Lists.isRdfRest(quad.predicate.value);
  }

  /**
   * Filter an external quad array to only include structurally valid quads.
   *
   * @remarks
   * Removes quads whose subject, predicate, object, or graph term types fall
   * outside the subset accepted by the project's RDF model. Specifically:
   * - Subject must be NamedNode or BlankNode.
   * - Predicate must be NamedNode.
   * - Object must satisfy {@link Lists.asQuadObject} (NamedNode, BlankNode, or Literal).
   * - Graph must be NamedNode, BlankNode, or DefaultGraph.
   *
   * @example
   * ```ts
   * const valid = Lists.narrowExternalQuads(externalQuads);
   * ```
   *
   * @param quads - External rdf/js quads to narrow.
   * @returns Filtered array of Quad objects matching the project RDF model.
   *
   * @category RDF
   * @since 0.1.0
   * @see {@link Lists.asQuadObject}
   * @group Lists
   */
  static narrowExternalQuads(quads: readonly Quad[]): Quad[] {
    const result: Quad[] = [];

    for (const quad of quads) {
      if (
        ResourceTermKindEntity.validate(quad.subject.termType)
        && NamedNodeKindEntity.validate(quad.predicate.termType)
        && Lists.asQuadObject(quad.object) !== undefined
        && GraphTermKindEntity.validate(quad.graph.termType)
      ) {
        result.push(quad);
      }
    }

    return result;
  }

  /**
   * Issue a blank node term. If `issuer` is provided, uses the per-call issuer's
   * counter (concurrent-safe). Otherwise falls back to a module-level counter.
   */
  private static nextListBnodeWithFallback(issuer: IdentifierIssuerInterface | undefined): BlankNode {
    if (issuer !== undefined) {
      return Terms.blank(issuer.getId());
    }

    return Terms.blank(`list${Lists.listBnodeCounter++}`);
  }

  /**
   * Reset the module-level list bnode counter.
   *
   * @remarks
   * Only needed for callers that do not use an IdentifierIssuerInterface.
   * Using an IdentifierIssuer is the recommended approach for concurrent safety.
   *
   * @example
   * ```ts
   * Lists.reset(); // reset before a deterministic test run
   * ```
   *
   * @category RDF
   * @since 0.1.0
   * @see {@link Lists.build}
   * @group Lists
   * @returns void
   */
  static reset(): void {
    Lists.listBnodeCounter = 0;
  }
}
