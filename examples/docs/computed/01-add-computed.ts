/**
 * addComputed — Example 1: Derived `subtotal` on the canonical Order
 *
 * Demonstrates `addComputed` against the real registered `OrderSchema`
 * from the bookstore. `addComputed` registers a derivation function for
 * a property name; on every subsequent `instantiate()` the materializer
 * invokes the fn with the live instance and writes the result onto the
 * output value.
 *
 * The canonical `OrderSchema` does not declare `subtotal` as a property
 * — it is layered on at runtime via `addComputed`, then read back from
 * the materialized result. This keeps the canonical schema free of
 * mandatory computed-field commitments while still demonstrating the
 * surface against real registered data.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

interface OrderItems {
  'items': ReadonlyArray<{
    'quantity': number;
    'unitPrice': { 'amount': number };
  }>;
}

bookstoreEntities.addComputed<OrderItems & { 'subtotal': number }>(
  OrderSchema.$id,
  'subtotal',
  (order) => {
    return order.items.reduce(
      (sum, line) => {
        return sum + (line.unitPrice.amount * line.quantity);
      },
      0
    );
  }
);

const materialized = bookstoreEntities.instantiate(OrderSchema.$id, aboxFixtures.order);
const expected = aboxFixtures.order.items.reduce(
  (sum, line) => {
    return sum + (line.unitPrice.amount * line.quantity);
  },
  0
);

console.assert(Math.abs((materialized as { 'subtotal': number }).subtotal - expected) < 0.005);

// removeComputed unregisters the fn; further instantiate() calls drop the field.
bookstoreEntities.removeComputed(OrderSchema.$id, 'subtotal');
const after = bookstoreEntities.instantiate(OrderSchema.$id, aboxFixtures.order);

console.assert(!('subtotal' in (after as object)));
