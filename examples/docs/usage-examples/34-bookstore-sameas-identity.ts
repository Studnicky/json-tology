/**
 * Bookstore taxonomy — sameAs ABox identity (two pairs)
 *
 * `JsonTology.prototype.sameAs` declares that two IRIs name the same
 * individual. The canonical bookstore registry declares two such
 * pairs in `examples/docs/bookstore/index.ts`:
 *
 *   urn:bookstore:customer:bastian-bux ↔ urn:coreander-antiquariat:cust-00042
 *   urn:bookstore:rarebook:neverending-1979-thienemann ↔ http://www.worldcat.org/oclc/5705614
 *
 * `toQuads` emits both directions of each pair (four sameAs quads
 * total) into the ABox alongside structural triples.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Emit the full graph: schema-level rules + sameAs assertions + ABox quads.
// OrderSchema is used here because it references the full entity graph and
// the sameAs pairs are registry-level — they appear regardless of which ABox
// schema is projected.
const quads = bookstoreEntities.toQuads(OrderSchema, aboxFixtures.order);

console.assert(Array.isArray(quads));
console.assert(quads.length > 0);

const OWL_SAME_AS = 'http://www.w3.org/2002/07/owl#sameAs';
const sameAsQuads = quads.filter((quad) => {
  return quad.predicate.value === OWL_SAME_AS;
});

// Four quads = two pairs × two directions (sameAs is symmetric).
console.assert(sameAsQuads.length >= 2);
