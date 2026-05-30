/**
 * Skolemize.wellKnownGenid — reversible W3C RDF 1.1 §3.5 pattern.
 *
 * Mints IRIs of the form `<baseIRI>/.well-known/genid/<hash>`. These are
 * intentionally reversible — fromQuads({ deskolemize: true }) recognises
 * the pattern and rewrites the IRIs back to blank nodes during lift.
 *
 * Use this when publishing RDF over the wire (which requires named
 * subjects) while preserving blank-node identity on the receiving end.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

const quads = bookstoreEntities.toQuads(CustomerSchema, customer, { 'iriFor': Skolemize.wellKnownGenid('https://shop.example.com') });

// Round-trip back to blank-node semantics — use the string key form for full type inference
const [restored] = bookstoreEntities.fromQuads(CustomerSchema.$id, quads, { 'deskolemize': true });

console.assert(restored.customerId === customer.customerId, 'customer id round-tripped through genid');

const genidIri = quads[0]?.subject.value ?? '';

console.log('well-known genid IRI:', genidIri);
console.log('round-tripped customerId:', restored.customerId);
