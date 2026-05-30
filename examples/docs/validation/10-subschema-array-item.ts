/**
 * subschemaAt — Example: array item schema
 *
 * `subschemaAt` walks the JSON Pointer into the canonical OrderSchema
 * and returns the OrderLine schema reachable at
 * `/properties/orderLines/items`. The Bastian-ordered fixture's first line
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
  '/properties/orderLines/items'
);

const line = jt.instantiate(
  orderLineSubschema,
  aboxFixtures.order.orderLines[0]
) as { 'bookIsbn': string;
  'quantity': number };

console.assert(line.bookIsbn === aboxFixtures.order.orderLines[0].bookIsbn);
console.assert(line.quantity === aboxFixtures.order.orderLines[0].quantity);

console.log('orderLine sub-schema id:', orderLineSubschema.$id);
console.log('coerced line isbn:', line.bookIsbn, ', quantity:', line.quantity);
