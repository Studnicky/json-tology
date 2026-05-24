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
import type { IdentifierIssuerInterface } from '../../interfaces/IdentifierIssuer.js';
import { RDF } from '../../constants/IRI.js';
import { Terms } from './Terms.js';

function isRdfFirst(value: string): boolean {
  return value === RDF.first;
}

function isRdfRest(value: string): boolean {
  return value === RDF.rest;
}

function isRdfNil(value: string): boolean {
  return value === RDF.nil;
}

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

/**
 * Reset the module-level list bnode counter.
 * Only needed for callers that do not use an IdentifierIssuerInterface.
 */
export function resetListBnodeCounter(): void {
  listBnodeCounter = 0;
}

/**
 * Build the RDF list encoding for `items`.
 *
 * @param items - Term objects to encode as an RDF list.
 * @param issuer - Optional per-call identifier issuer. When omitted, falls
 *   back to a module-level counter (not concurrent-safe).
 */
export function build(
  items: readonly QuadObjectType[],
  issuer?: IdentifierIssuerInterface
): {
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
  const head = nextListBnodeWithFallback(issuer);
  let current: BnodeTermType = head;

  for (let i = 0; i < items.length; i++) {
    triples.push(buildQuad(current, Terms.iri(RDF.first), items[i]));

    if (i < items.length - 1) {
      const next = nextListBnodeWithFallback(issuer);

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

export function asQuadObject(obj: Quad['object']): QuadObjectType | undefined {
  if (obj.termType === 'NamedNode' || obj.termType === 'BlankNode' || obj.termType === 'Literal') {
    return obj;
  }

  return undefined;
}

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
