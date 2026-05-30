/**
 * Round-trip a customer through quads.
 *
 * Project the validated customer to RDF, then lift the quads back through
 * fromQuads. Each lifted object passes through instantiate, so defaults
 * and transforms apply on the return path.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const original = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

const quads = bookstoreEntities.toQuads(CustomerSchema, original);
const [restored] = bookstoreEntities.fromQuads(CustomerSchema.$id, quads);

console.assert(restored.customerId === original.customerId, 'customer id round-tripped');
console.assert(restored.name === original.name, 'customer name round-tripped');
