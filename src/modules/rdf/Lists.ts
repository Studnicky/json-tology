/**
 * Lists — build a standard RDF list triple sequence from a flat item array.
 *
 * Every internal and public quad in the project is an rdf/js spec `Quad` from
 * `@rdfjs/types`. There is no project-internal "list term" abstraction. When a
 * projection (`owl:unionOf`, `sh:or`, `sh:in`, `sh:and`, etc.) needs an RDF
 * list, it calls `Lists.build(items)`, attaches the returned `head` BlankNode
 * to whatever predicate slot wants the list, and concatenates the returned
 * `triples` into its output quad array.
 *
 * The encoding is the canonical RDF list shape:
 *   _:b0 rdf:first item0 .
 *   _:b0 rdf:rest  _:b1 .
 *   _:b1 rdf:first item1 .
 *   _:b1 rdf:rest  _:b2 .
 *   ...
 *   _:bN rdf:first itemN .
 *   _:bN rdf:rest  rdf:nil .
 *
 * Nested lists are supported: pass `Lists.build(nested)` recursively and use
 * its `head` as an item in the outer list.
 */

import type { Quad } from '@rdfjs/types';
import type {
  BnodeTermType, IriTermType, QuadObjectType
} from '../../types/Quad.js';
import { RDF } from '../../constants/IRI.js';
import { Terms } from './Terms.js';

// rdf:first / rdf:rest / rdf:nil appear in two forms in the project's quad
// streams: the full W3C IRI emitted by external sources / JsonLdToQuads, and
// the CURIE string emitted by QuadFactory and `Lists.build`. List walking
// recognises either form.
const RDF_NS = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#';
const RDF_FIRST_FULL = `${RDF_NS}first`;
const RDF_REST_FULL = `${RDF_NS}rest`;
const RDF_NIL_FULL = `${RDF_NS}nil`;

function isRdfFirst(value: string): boolean {
  return value === RDF.first || value === RDF_FIRST_FULL;
}

function isRdfRest(value: string): boolean {
  return value === RDF.rest || value === RDF_REST_FULL;
}

function isRdfNil(value: string): boolean {
  return value === RDF.nil || value === RDF_NIL_FULL;
}

let listBnodeCounter = 0;

function nextListBnode(): BnodeTermType {
  return Terms.blank(`list${listBnodeCounter++}`);
}

/**
 * Reset the per-projection list-bnode counter. Call at the start of a fresh
 * projection (e.g. inside `OwlProjection.graph()` / `ShaclProjection.graph()`)
 * so the produced bnode names are deterministic.
 */
export function resetListBnodeCounter(): void {
  listBnodeCounter = 0;
}

/**
 * Build the RDF list encoding for `items`. Returns the list's head (used as
 * the object position by the parent triple) plus the standard
 * `rdf:first` / `rdf:rest` / `rdf:nil` triples that materialise the list.
 *
 * For an empty `items` array, the head is `rdf:nil` and no triples are
 * emitted.
 */
export function build(items: readonly QuadObjectType[]): {
  readonly 'head': BnodeTermType | IriTermType;
  readonly 'triples': Quad[];
} {
  if (items.length === 0) {
    return {
      'head': Terms.iri(RDF.nil),
      'triples': []
    };
  }

  const triples: Quad[] = [];
  const head = nextListBnode();
  let current: BnodeTermType = head;

  for (let i = 0; i < items.length; i++) {
    triples.push(buildQuad(current, Terms.iri(RDF.first), items[i]));

    if (i < items.length - 1) {
      const next = nextListBnode();

      triples.push(buildQuad(current, Terms.iri(RDF.rest), next));
      current = next;
    } else {
      triples.push(buildQuad(current, Terms.iri(RDF.rest), Terms.iri(RDF.nil)));
    }
  }

  return {
    head,
    triples
  };
}

function buildQuad(
  subject: BnodeTermType | IriTermType,
  predicate: IriTermType,
  object: QuadObjectType
): Quad {
  return Terms.quad(subject, predicate, object);
}

/**
 * Walk the `rdf:first` / `rdf:rest` chain rooted at `head` and collect every
 * item in encounter order. Stops at `rdf:nil`. If `head` is `rdf:nil` (the
 * empty list IRI) or the chain is malformed, returns an empty array.
 *
 * `allQuads` is the full quad stream the head is embedded in — the inverse
 * pipeline reads list items by following `rdf:first` / `rdf:rest` edges,
 * so the caller passes whichever quad collection contains them.
 */
export function collect(
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

    const cursor = current;
    const firstQuad = allQuads.find((quad) => {
      return quad.subject.equals(cursor) && isRdfFirst(quad.predicate.value);
    });

    if (firstQuad === undefined) {
      break;
    }
    const item = firstQuad.object;

    if (item.termType === 'NamedNode' || item.termType === 'BlankNode' || item.termType === 'Literal') {
      items.push(item);
    }

    const restQuad = allQuads.find((quad) => {
      return quad.subject.equals(cursor) && isRdfRest(quad.predicate.value);
    });

    if (restQuad === undefined) {
      break;
    }
    const rest = restQuad.object;

    if (rest.termType === 'NamedNode' && isRdfNil(rest.value)) {
      break;
    }
    if (rest.termType !== 'NamedNode' && rest.termType !== 'BlankNode') {
      break;
    }
    current = rest;
  }

  return items;
}

/**
 * Type-guard narrow of an rdf/js `Quad_Object` (= `NamedNode | Literal |
 * BlankNode | Quad | Variable`) to the project's `QuadObjectType`
 * (= `NamedNode | BlankNode | Literal`). Returns `undefined` for RDF*
 * `Quad` and `Variable` terms that the project's pipeline does not handle.
 *
 * Use this at every site where an `object` term is dispatched into the
 * project's class-expression / datatype / restriction handlers.
 */
export function asQuadObject(obj: Quad['object']): QuadObjectType | undefined {
  if (obj.termType === 'NamedNode' || obj.termType === 'BlankNode' || obj.termType === 'Literal') {
    return obj;
  }

  return undefined;
}

/**
 * Filter quads supplied by external callers down to the project's accepted
 * shape — drop any quad whose subject, predicate, object, or graph carries
 * a `Variable` or nested `Quad` (RDF*) term. The returned array is the same
 * `Quad[]` rdf/js shape — narrowing is by content, not by type.
 */
export function narrowExternalQuads(quads: readonly Quad[]): Quad[] {
  return quads.filter((quad) => {
    return (quad.subject.termType === 'NamedNode' || quad.subject.termType === 'BlankNode')
      && quad.predicate.termType === 'NamedNode'
      && asQuadObject(quad.object) !== undefined
      && (quad.graph.termType === 'NamedNode' || quad.graph.termType === 'BlankNode' || quad.graph.termType === 'DefaultGraph');
  });
}

export const Lists = {
  asQuadObject,
  build,
  collect,
  narrowExternalQuads,
  resetListBnodeCounter
} as const;
