/**
 * subschemaAt — Example: array item schema
 *
 * `subschemaAt` walks the JSON Pointer into the canonical OrderSchema
 * and returns the OrderLine schema reachable at
 * `/properties/items/items`. The Bastian-ordered fixture's first line
 * round-trips cleanly through that subschema.
 */

import {
  aboxFixtures, createBookstoreDocRegistry,
  OrderSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const orderLineSubschema = jt.subschemaAt(
  OrderSchema.$id,
  '/properties/items/items'
);

const line = jt.instantiate(
  orderLineSubschema,
  aboxFixtures.order.items[0]
) as { 'bookIsbn': string;
  'quantity': number };

console.assert(line.bookIsbn === aboxFixtures.order.items[0].bookIsbn);
console.assert(line.quantity === aboxFixtures.order.items[0].quantity);
