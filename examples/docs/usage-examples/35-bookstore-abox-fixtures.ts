/**
 * Bookstore taxonomy — using aboxFixtures across schemas
 *
 * The `aboxFixtures` export carries concrete instance data for the
 * Bastian-orders-Neverending-Story scenario. Each fixture matches a
 * registered schema verbatim; `instantiate` and `toQuads` accept the
 * fixtures directly so the same scenario can be reused across docs
 * pages and integration tests.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema, RareBookSchema
} from '../bookstore/index.js';

// Validate the rare-book record itself (passes RareBook's hierarchy:
// Book + PrintBook structural rules + someValuesFrom + maxCardinality(authors=1)).
const rareBook = bookstoreEntities.instantiate(RareBookSchema, aboxFixtures.rareBook);

console.assert(typeof rareBook === 'object');
// 'Die unendliche Geschichte'
console.log('rareBook title:', (rareBook as { 'title': string }).title);

// Validate Bastian's order containing one line for that rare book.
// The branded instantiate result feeds toQuads's typed signature directly.
const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

console.assert(typeof order === 'object');
// fixture customerId
console.log('order customerId:', (order as { 'customerId': string }).customerId);

// Emit the full RDF graph: schema-level rules + sameAs assertions + ABox quads.
const quads = bookstoreEntities.toQuads(OrderSchema, order);

console.assert(quads.length > 0);
// all quads including sameAs pairs
console.log('ABox quad count:', quads.length);
