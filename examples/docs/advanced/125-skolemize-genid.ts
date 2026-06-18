/**
 * Skolemize.wellKnownGenid and Skolemize.isWellKnownGenid.
 *
 * `Skolemize.wellKnownGenid(baseIRI)` returns a strategy that mints IRIs of
 * the form `<baseIRI>/.well-known/genid/<contentHash>`. These are reversible:
 * `fromQuads({ deskolemize: true })` detects the pattern and rewrites such
 * IRIs back to blank nodes on lift.
 *
 * `Skolemize.isWellKnownGenid(iri)` tests whether a given IRI matches the
 * W3C RDF 1.1 §3.5 well-known genid pattern — useful when writing custom
 * deskolemization passes or filtering quad sets.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';
import { Skolemize } from '../../../src/index.js';

// Produce a well-known genid IRI by minting quads with the wellKnownGenid strategy.
const genidStrategy = Skolemize.wellKnownGenid('https://shop.example.com');
const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);
const quads = bookstoreEntities.toQuads(CustomerSchema, customer, { 'iriFor': genidStrategy });

const subjectIri = quads[0]?.subject.value ?? '';

console.assert(subjectIri.length > 0, 'toQuads must produce at least one quad with a subject');

// The minted IRI must contain the .well-known/genid/ path segment.
console.assert(
  subjectIri.includes('/.well-known/genid/'),
  `subject IRI must contain /.well-known/genid/; got: ${subjectIri}`
);

console.log('minted well-known genid IRI:', subjectIri);

// isWellKnownGenid — true for a well-known genid IRI, false for plain IRIs.
const isGenid = Skolemize.isWellKnownGenid(subjectIri);
const isGenidPlain = Skolemize.isWellKnownGenid('https://shop.example.com/customers/alice');
const isGenidEmpty = Skolemize.isWellKnownGenid('');

console.assert(isGenid, 'isWellKnownGenid must return true for a minted genid IRI');
console.assert(
  !isGenidPlain,
  'isWellKnownGenid must return false for a plain IRI'
);
console.assert(
  !isGenidEmpty,
  'isWellKnownGenid must return false for an empty string'
);

console.log('isWellKnownGenid(genid IRI):', isGenid);
console.log('isWellKnownGenid(plain IRI):', isGenidPlain);
console.log('isWellKnownGenid(\'\'):', isGenidEmpty);

// Round-trip: deskolemize recovers the original typed object from genid quads.
const restoredList = bookstoreEntities.fromQuads(CustomerSchema.$id, quads, { 'deskolemize': true });
const restored = restoredList[0];

if (restored === undefined) {
  throw new Error('expected restored customer');
}

console.assert(
  restored.customerId === customer.customerId,
  'deskolemized customer must match original customerId'
);
console.log('round-tripped customerId:', restored.customerId);
