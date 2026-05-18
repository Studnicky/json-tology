/**
 * Lift: json-tology quads are rdf/js-compatible — no conversion bridge needed.
 *
 * `QuadInterface` is now structurally compatible with @rdfjs/types: subject,
 * predicate, graph, and object are all term objects (termType + value + equals).
 * Internal quads from `toQuads()` can be passed directly to any rdf/js consumer
 * that reads the standard term shape.
 *
 * Use `Lift.fromExternalQuad` only when an external library produces quads with
 * string-serialised XSD datatypes or full IRI rdf:type — i.e. when normalisation
 * to the project's prefixed form is needed before calling `fromQuads()`.
 */

import { Lift } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Produce quads via toQuads — these are rdf/js-compatible
const internalQuads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

console.assert(internalQuads.length > 0, 'quads produced');

// QuadInterface carries term objects (rdf/js-compatible), not bare strings
const first = internalQuads[0];

console.assert(
  typeof first.subject.value === 'string',
  'quad subject is an rdf/js term object with a .value string'
);
console.assert(
  first.subject.termType === 'NamedNode',
  'toQuads produces NamedNode subjects for hash-minted IRIs'
);

// Correct usage: pass quads back to json-tology (fromQuads)
const lifted = bookstoreEntities.fromQuads(CustomerSchema.$id, internalQuads);

console.assert(lifted.length > 0, 'fromQuads recovers typed objects from quads');

// Lift.fromExternalQuad adapts external libraries that emit quads with
// full XSD IRI datatypes or full rdf:type IRIs (e.g. n3, eyereasoner)
console.assert(typeof Lift.fromExternalQuad === 'function', 'Lift.fromExternalQuad is callable');
