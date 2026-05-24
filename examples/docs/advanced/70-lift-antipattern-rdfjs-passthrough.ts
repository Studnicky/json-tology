/**
 * json-tology quads are rdf/js-compatible — no conversion bridge needed.
 *
 * `QuadInterface` is structurally compatible with @rdfjs/types: subject,
 * predicate, graph, and object are all term objects (termType + value + equals)
 * carrying full IRIs in `.value`. Internal quads from `toQuads()` flow into any
 * rdf/js consumer; external rdf/js quads (from n3, rdflib, eyereasoner) flow
 * back through `fromQuads` directly. `Lists.narrowExternalQuads` filters and
 * type-narrows external quads when needed.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const internalQuads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

console.assert(internalQuads.length > 0, 'quads produced');

const first = internalQuads[0];

console.assert(
  typeof first.subject.value === 'string',
  'quad subject is an rdf/js term object with a .value string'
);
console.assert(
  first.subject.termType === 'NamedNode',
  'toQuads produces NamedNode subjects for hash-minted IRIs'
);

const lifted = bookstoreEntities.fromQuads(CustomerSchema.$id, internalQuads);

console.assert(lifted.length > 0, 'fromQuads recovers typed objects from quads');

console.assert(
  first.predicate.value.startsWith('http') || first.predicate.value.startsWith('urn'),
  'predicate.value is a full IRI, not a compact CURIE'
);
