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

// Imperative add after construction. addComputed returns a registry whose
// `Order` type is augmented with the computed `discountedTotal`.
const withDiscount = bookstoreEntities.addComputed(
  OrderSchema.$id,
  'discountedTotal',
  (order) => {
    return order.items.reduce((sum, line) => {
      return sum + (line.unitPrice.amount * line.quantity);
    }, 0);
  }
);

const order = withDiscount.instantiate(OrderSchema.$id, aboxFixtures.order);
const expectedTotal = aboxFixtures.order.items.reduce(
  (sum, line) => {
    return sum + (line.unitPrice.amount * line.quantity);
  },
  0
);

console.assert(Math.abs(order.discountedTotal - expectedTotal) < 0.005);

// Cleanup so subsequent tests are not affected.
withDiscount.removeComputed(OrderSchema.$id, 'discountedTotal');
