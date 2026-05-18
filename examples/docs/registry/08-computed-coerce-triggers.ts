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

interface OrderWithLineCount {
  'items': readonly unknown[];
  'lineCount': number;
}

bookstoreEntities.addComputed<OrderWithLineCount>(
  OrderSchema,
  'lineCount',
  (order) => {
    return order.items.length;
  }
);

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
// lineCount omitted from input — computed from items.length.
const expectedLineCount = aboxFixtures.order.items.length;

console.assert(Math.abs((order as { 'lineCount': number }).lineCount - expectedLineCount) < 0.001);

// Cleanup: remove the computed field so other examples are unaffected.
bookstoreEntities.removeComputed(OrderSchema, 'lineCount');
