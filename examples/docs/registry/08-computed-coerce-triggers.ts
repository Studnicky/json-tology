/**
 * addComputed — Example 2: Coerce triggers the compute function
 * Demonstrates: instantiate() invokes the registered compute fn, field is absent from input
 *
 * A `lineCount` computed field is layered onto OrderSchema at runtime.
 * The canonical Bastian Balthazar Bux order fixture omits `lineCount` from
 * input — the compute function derives it from `items.length`.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// addComputed returns a registry whose `Order` type is augmented with the
// computed `lineCount`, so `instantiate(OrderSchema.$id, …)` returns it typed.
const withLineCount = bookstoreEntities.addComputed(
  OrderSchema.$id,
  'lineCount',
  (order) => {
    return order.orderLines.length;
  }
);

const order = withLineCount.instantiate(OrderSchema.$id, aboxFixtures.order);
// lineCount omitted from input — computed from orderLines.length.
const expectedLineCount = aboxFixtures.order.orderLines.length;

console.assert(Math.abs(order.lineCount - expectedLineCount) < 0.001);

// Cleanup: remove the computed field so other examples are unaffected.
withLineCount.removeComputed(OrderSchema.$id, 'lineCount');
