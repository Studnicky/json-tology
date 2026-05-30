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

const computeSubtotal = (items: ReadonlyArray<{ 'quantity': number;
  'unitPrice': { 'amount': number } }>): number => {
  return items.reduce((sum, line) => {
    return sum + (line.unitPrice.amount * line.quantity);
  }, 0);
};

// addComputed returns a registry whose `Order` type is AUGMENTED with the
// computed `subtotal`, so subsequent `instantiate(OrderSchema.$id, …)` returns
// it fully typed — no cast needed to read the computed field.
const withSubtotal = bookstoreEntities.addComputed(
  OrderSchema.$id,
  'subtotal',
  (order) => {
    return computeSubtotal(order.orderLines);
  }
);

const materialized = withSubtotal.instantiate(OrderSchema.$id, aboxFixtures.order);
const expected = computeSubtotal(aboxFixtures.order.orderLines);

console.assert(Math.abs(materialized.subtotal - expected) < 0.005);

console.log('order lines:', JSON.stringify(aboxFixtures.order.orderLines));
console.log('expected subtotal:', expected);
console.log('computed subtotal:', materialized.subtotal);

// removeComputed unregisters the fn; further instantiate() calls drop the field.
withSubtotal.removeComputed(OrderSchema.$id, 'subtotal');
const after = withSubtotal.instantiate(OrderSchema.$id, aboxFixtures.order);

console.assert(!Reflect.has(after, 'subtotal'));

console.log('subtotal after removeComputed:', Reflect.has(after, 'subtotal') ? after : '(field absent)');
