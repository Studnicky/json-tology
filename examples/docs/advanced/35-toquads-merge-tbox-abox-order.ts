/**
 * Merge an order ABox with the bookstore TBox.
 *
 * toTbox() returns class and property declarations; toQuads(OrderSchema, order)
 * returns ABox individual assertions. Spreading both into a single @graph
 * produces a self-contained JSON-LD document with vocabulary and instance
 * data co-located.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

const tbox = bookstoreEntities.toTbox();
const abox = bookstoreEntities.toQuads(OrderSchema, order);

// tbox.raw() — class and property declarations.
// abox — individual assertions (QuadInterface[]).
const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...tbox.raw(),
    ...abox
  ]
};

console.assert(merged['@context'], 'context present');
console.assert(merged['@graph'].length > tbox.raw().length, 'ABox extended TBox @graph');
