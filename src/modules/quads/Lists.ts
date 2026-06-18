/**
 * Lists — build a standard RDF list triple sequence from a flat item array.
 *
 * The encoding is the canonical RDF list shape:
 *   _:b0 rdf:first item0 .
 *   _:b0 rdf:rest  _:b1 .
 *   ...
 *   _:bN rdf:rest  rdf:nil .
 */

import type { Quad } from '@rdfjs/types';
import type {
  BnodeTermType, IriTermType, QuadObjectType
} from '../../types/Quad.js';
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuerInterface.js';
import type { ListBuildResultType } from '../../types/ListBuildResultType.js';
import type { OptionalListObjectType } from '../../types/OptionalListObjectType.js';
import type { CollectStepResultType } from '../../types/CollectStepResultType.js';
import { RDF } from '../../constants/IRI.js';
import { Terms } from './Terms.js';

// ---------------------------------------------------------------------------
// Predicate helpers
// ---------------------------------------------------------------------------

function isRdfFirst(value: string): boolean {
  return value === RDF.first;
}

function isRdfRest(value: string): boolean {
  return value === RDF.rest;
}

function isRdfNil(value: string): boolean {
  return value === RDF.nil;
}

// ---------------------------------------------------------------------------
// Blank node allocation
// ---------------------------------------------------------------------------

// Module-level fallback counter — used when no issuer is supplied.
let listBnodeCounter = 0;

/**
 * Issue a blank node term. If `issuer` is provided, uses the per-call issuer's
 * counter (concurrent-safe). Otherwise falls back to a module-level counter.
 */
function nextListBnodeWithFallback(issuer: IdentifierIssuerInterface | undefined): BnodeTermType {
  if (issuer !== undefined) {
    return Terms.blank(issuer.getId());
  }

  return Terms.blank(`list${listBnodeCounter++}`);
}

// ---------------------------------------------------------------------------
// Subject-predicate match helpers for collect()
// ---------------------------------------------------------------------------

function isFirstTriple(quad: Quad, cursor: BnodeTermType | IriTermType): boolean {
  return quad.subject.equals(cursor) && isRdfFirst(quad.predicate.value);
}

function isRestTriple(quad: Quad, cursor: BnodeTermType | IriTermType): boolean {
  return quad.subject.equals(cursor) && isRdfRest(quad.predicate.value);
}

function isValidQuadObjectTermType(termType: string): boolean {
  return termType === 'NamedNode' || termType === 'BlankNode' || termType === 'Literal';
}

function isValidSubject(quad: Quad): boolean {
  return quad.subject.termType === 'NamedNode' || quad.subject.termType === 'BlankNode';
}

function isValidGraph(quad: Quad): boolean {
  return quad.graph.termType === 'NamedNode'
    || quad.graph.termType === 'BlankNode'
    || quad.graph.termType === 'DefaultGraph';
}

// ---------------------------------------------------------------------------
// collect() loop helpers
// ---------------------------------------------------------------------------

function collectStep(
  cursor: BnodeTermType | IriTermType,
  allQuads: readonly Quad[]
): CollectStepResultType {
  const firstQuad = allQuads.find((quad: Quad): boolean => {
    return isFirstTriple(quad, cursor);
  });

  if (firstQuad === undefined) {
    return {
      'done': true,
      'item': undefined,
      'next': undefined
    };
  }

  const item: OptionalListObjectType = isValidQuadObjectTermType(firstQuad.object.termType)
    ? firstQuad.object as QuadObjectType
    : undefined;

  const restQuad = allQuads.find((quad: Quad): boolean => {
    return isRestTriple(quad, cursor);
  });

  if (restQuad === undefined) {
    return {
      'done': true,
      item,
      'next': undefined
    };
  }

  const rest = restQuad.object;

  if (rest.termType === 'NamedNode' && isRdfNil(rest.value)) {
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

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Reset the module-level list bnode counter.
 *
 * @remarks
 * Only needed for callers that do not use an IdentifierIssuerInterface.
 * Using an IdentifierIssuer is the recommended approach for concurrent safety.
 *
 * @example
 * ```ts
 * resetListBnodeCounter(); // reset before a deterministic test run
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link build}
 * @group Lists
 * @returns void
 */
function resetListBnodeCounter(): void {
  listBnodeCounter = 0;
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
 * const { head, triples } = build([Terms.iri(XSD.string)], issuer);
 * ```
 *
 * @param items - Term objects to encode as an RDF list.
 * @param issuer - Optional per-call identifier issuer. When omitted, falls
 *   back to a module-level counter (not concurrent-safe).
 * @returns An object with `head` (the first bnode or rdf:nil) and `triples`.
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link collect}
 * @group Lists
 */
function build(
  items: readonly QuadObjectType[],
  issuer?: IdentifierIssuerInterface
): ListBuildResultType {
  if (items.length === 0) {
    return {
      'head': Terms.iri(RDF.nil),
      'triples': []
    };
  }

  const triples: Quad[] = [];
  const head = nextListBnodeWithFallback(issuer);
  let current: BnodeTermType = head;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];

    if (item === undefined) {
      continue;
    }

    triples.push(Terms.quad(current, Terms.iri(RDF.first), item));

    if (i < items.length - 1) {
      const next = nextListBnodeWithFallback(issuer);

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
 * const items = collect(listHead, quads);
 * ```
 *
 * @param head - The first node in the RDF list (NamedNode or BlankNode).
 * @param allQuads - The full quad set to search within.
 * @returns Ordered array of QuadObjectType items extracted from the list.
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link build}
 * @group Lists
 */
function collect(
  head: BnodeTermType | IriTermType,
  allQuads: readonly Quad[]
): QuadObjectType[] {
  if (head.termType === 'NamedNode' && isRdfNil(head.value)) {
    return [];
  }

  const items: QuadObjectType[] = [];
  const seen = new Set<string>();
  let current: BnodeTermType | IriTermType = head;

  while (!seen.has(`${current.termType}:${current.value}`)) {
    seen.add(`${current.termType}:${current.value}`);

    const step = collectStep(current, allQuads);

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
 * const narrowed = asQuadObject(quad.object);
 * if (narrowed !== undefined) { ... }
 * ```
 *
 * @param obj - The raw rdf/js term from `Quad['object']`.
 * @returns The narrowed QuadObjectType, or undefined if not a valid object term.
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link narrowExternalQuads}
 * @group Lists
 */
function asQuadObject(obj: Quad['object']): OptionalListObjectType {
  if (isValidQuadObjectTermType(obj.termType)) {
    return obj as QuadObjectType;
  }

  return undefined;
}

/**
 * Filter an external quad array to only include structurally valid quads.
 *
 * @remarks
 * Removes quads whose subject, predicate, object, or graph term types fall
 * outside the subset accepted by the project's RDF model. Specifically:
 * - Subject must be NamedNode or BlankNode.
 * - Predicate must be NamedNode.
 * - Object must satisfy {@link asQuadObject} (NamedNode, BlankNode, or Literal).
 * - Graph must be NamedNode, BlankNode, or DefaultGraph.
 *
 * @example
 * ```ts
 * const valid = narrowExternalQuads(externalQuads);
 * ```
 *
 * @param quads - External rdf/js quads to narrow.
 * @returns Filtered array of Quad objects matching the project RDF model.
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link asQuadObject}
 * @group Lists
 */
function narrowExternalQuads(quads: readonly Quad[]): Quad[] {
  const result: Quad[] = [];

  for (const quad of quads) {
    if (
      isValidSubject(quad)
      && quad.predicate.termType === 'NamedNode'
      && asQuadObject(quad.object) !== undefined
      && isValidGraph(quad)
    ) {
      result.push(quad);
    }
  }

  return result;
}

/**
 * RDF list utilities — build, traverse, and filter standard rdf:first/rdf:rest chains.
 *
 * @remarks
 * Encodes the canonical RDF list shape using rdf:first / rdf:rest / rdf:nil triple sequences.
 * All functions operate on rdf/js-compatible Quad objects and project-native QuadObjectType terms.
 *
 * @example
 * ```ts
 * const { head, triples } = Lists.build([Terms.iri(XSD.string)], issuer);
 * const items = Lists.collect(head, allQuads);
 * ```
 *
 * @category RDF
 * @since 0.1.0
 * @see {@link build}
 * @group Lists
 * @defaultValue Immutable namespace object — use the named exports directly for tree-shaking.
 */
export const Lists = {
  asQuadObject,
  build,
  collect,
  isRdfFirst,
  isRdfNil,
  isRdfRest,
  narrowExternalQuads,
  resetListBnodeCounter
} as const;
