/**
 * subschemaAt — Example: array item schema
 *
 * `subschemaAt` walks the JSON Pointer into the canonical OrderSchema
 * and returns the OrderLine schema reachable at
 * `/properties/items/items`. The Bastian-ordered fixture's first line
 * round-trips cleanly through that subschema.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const orderLineSubschema = bookstoreEntities.subschemaAt(
  OrderSchema.$id,
  '/properties/items/items'
);

const line = bookstoreEntities.instantiate(
  orderLineSubschema,
  aboxFixtures.order.items[0]
) as { 'bookIsbn': string;
  'quantity': number };

console.assert(line.bookIsbn === aboxFixtures.order.items[0].bookIsbn);
console.assert(line.quantity === aboxFixtures.order.items[0].quantity);
