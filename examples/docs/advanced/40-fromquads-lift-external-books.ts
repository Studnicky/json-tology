/**
 * Lift quads from an external source into typed Customer objects.
 *
 * In production, quads arrive from a SPARQL CONSTRUCT, a DESCRIBE query,
 * a reasoner output, or an inbound RDF payload. Here we simulate the
 * external source by projecting a customer through toQuads first, then
 * lifting that quad set back through fromQuads. fromQuads returns a
 * Customer[] — validated, typed, defaults applied.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Stand-in for `await fetchQuadsFromTripleStore('... WHERE { ?c a :Customer }')`.
const externalQuads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer);

// fromQuads returns Customer[] — validated, typed, defaults applied.
const customers = bookstoreEntities.fromQuads(CustomerSchema, externalQuads);

console.assert(customers.length > 0, 'lifted at least one Customer individual');
for (const customer of customers) {
  console.assert(typeof customer.name === 'string', 'customer.name lifted as string');
  console.assert(typeof customer.email === 'string', 'customer.email lifted as string');
}
