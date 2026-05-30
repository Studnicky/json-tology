/**
 * removeComputed — Example 1: Replace a compute function (discount tier swap)
 * Demonstrates: removeComputed + re-addComputed for runtime fn replacement
 *
 * The standard totaliser is replaced by a gold-tier 10% discount totaliser for
 * the Bastian Balthazar Bux order. After the example the field is removed so
 * the canonical registry is left unmodified.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Register standard totaliser, then replace it with a discounted one. Each
// addComputed returns a registry whose `Order` type carries `derivedTotal`.
const withTotal = bookstoreEntities.addComputed(
  OrderSchema.$id,
  'derivedTotal',
  (order) => {
    return order.orderLines.reduce((sum, line) => {
      return sum + (line.unitPrice.amount * line.quantity);
    }, 0);
  }
);

// Remove the existing totaliser, then register a discounted one (10% off).
withTotal.removeComputed(OrderSchema.$id, 'derivedTotal');

const withDiscounted = withTotal.addComputed(
  OrderSchema.$id,
  'derivedTotal',
  (order) => {
    return order.orderLines.reduce((sum, line) => {
      return sum + (line.unitPrice.amount * line.quantity);
    }, 0) * 0.9;
  }
);

const order = withDiscounted.instantiate(OrderSchema.$id, aboxFixtures.order);
const rawTotal = aboxFixtures.order.orderLines.reduce(
  (sum, line) => {
    return sum + (line.unitPrice.amount * line.quantity);
  },
  0
);

const expected = rawTotal * 0.9;

console.assert(Math.abs(order.derivedTotal - expected) < 0.005);

// Cleanup.
withDiscounted.removeComputed(OrderSchema.$id, 'derivedTotal');
