/**
 * addComputed — Example 3: Imperative registration after construction
 * Demonstrates: addComputed called against an already-constructed registry
 *
 * The canonical bookstore registry is constructed at module load time.
 * This example adds and then removes a `discountedTotal` computed field
 * imperatively — the pattern for dynamic discount tiers or feature-flag
 * controlled derivations. Fixtures are from the Bastian Balthazar Bux
 * order for the 1979 Thienemann first edition (€850.00).
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

interface OrderWithDiscount {
  'discountedTotal': number;
  'items': ReadonlyArray<{ 'quantity': number;
    'unitPrice': { 'amount': number } }>;
}

// Imperative add: register after construction.
bookstoreEntities.addComputed<OrderWithDiscount>(
  OrderSchema,
  'discountedTotal',
  (order) => {
    return order.items.reduce((sum, line) => {
      return sum + (line.unitPrice.amount * line.quantity);
    }, 0);
  }
);

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
const expectedTotal = aboxFixtures.order.items.reduce(
  (sum, line) => {
    return sum + (line.unitPrice.amount * line.quantity);
  },
  0
);

console.assert(Math.abs((order as { 'discountedTotal': number }).discountedTotal - expectedTotal) < 0.005);

// Cleanup so subsequent tests are not affected.
bookstoreEntities.removeComputed(OrderSchema, 'discountedTotal');
