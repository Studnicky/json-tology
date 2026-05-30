/**
 * Reversible skolemization via Skolemize.wellKnownGenid + fromQuads({ deskolemize }).
 *
 * The well-known genid pattern (W3C RDF 1.1 §3.5) produces deterministic IRIs
 * that fromQuads recognises and rewrites back to blank nodes during lift —
 * round-tripping blank-node identity across a wire-form serialization.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer, { 'iriFor': Skolemize.wellKnownGenid('https://shop.example.com') });

// Round-trip back to blank-node semantics — use the string key form for full type inference
const [restored] = bookstoreEntities.fromQuads(CustomerSchema.$id, quads, { 'deskolemize': true });

console.assert(restored.customerId === aboxFixtures.customer.customerId, 'customer id round-tripped');
console.log('round-tripped customerId:', restored.customerId);
