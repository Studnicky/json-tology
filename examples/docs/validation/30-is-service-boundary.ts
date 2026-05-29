/**
 * is — Example 3: Guards at a service boundary
 * Demonstrates: is() as a guard throwing TypeError on invalid shape
 *
 * processOrder rejects anything that isn't a valid Order; valid Bastian
 * fixture passes through without an explicit cast.
 */

import {
  aboxFixtures, bookstoreEntities, type Order, OrderSchema
} from '../bookstore/index.js';

function processOrder(data: unknown): string {
  // Passing the schema $id selects the type-guard overload, narrowing `data`.
  if (!bookstoreEntities.is(OrderSchema.$id, data)) {
    throw new TypeError('Expected an Order');
  }

  // data is Order from here — no explicit cast needed
  return `Processing order ${String(data.id)} for customer ${String(data.customerId)}`;
}

const validOrder: Order = bookstoreEntities.instantiate(
  OrderSchema.$id,
  aboxFixtures.order
);

const result = processOrder(validOrder);

console.assert(result.includes(aboxFixtures.order.id));
console.assert(result.includes(aboxFixtures.customer.id));

let threw = false;

try {
  processOrder({ 'id': 'not-an-order' });
} catch (error) {
  threw = error instanceof TypeError;
}

console.assert(threw);
