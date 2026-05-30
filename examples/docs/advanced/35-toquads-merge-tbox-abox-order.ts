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

// tbox graph — class and property declarations via JSON-LD formatter.
// abox — individual assertions (QuadInterface[]).
const tboxGraph = tbox.jsonLdObject()['@graph'] as unknown[];
const merged = {
  '@context': tbox.context(),
  '@graph': [
    ...tboxGraph,
    ...abox
  ]
};

console.assert(Boolean(merged['@context']), 'context present');
console.assert(merged['@graph'].length > tboxGraph.length, 'ABox extended TBox @graph');

console.log('TBox @graph nodes:', tboxGraph.length);
console.log('merged @graph nodes (TBox + ABox):', merged['@graph'].length);
