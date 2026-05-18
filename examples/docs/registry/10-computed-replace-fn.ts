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

interface OrderWithTotal {
  'derivedTotal': number;
  'items': ReadonlyArray<{ 'quantity': number;
    'unitPrice': { 'amount': number } }>;
}

// Register standard totaliser.
bookstoreEntities.addComputed<OrderWithTotal>(
  OrderSchema,
  'derivedTotal',
  (order) => {
    return order.items.reduce((sum, line) => {
      return sum + (line.unitPrice.amount * line.quantity);
    }, 0);
  }
);

// Remove the existing totaliser.
bookstoreEntities.removeComputed(OrderSchema, 'derivedTotal');

// Register a discounted totaliser (10% off for gold-tier customers).
bookstoreEntities.addComputed<OrderWithTotal>(
  OrderSchema,
  'derivedTotal',
  (order) => {
    const raw = order.items.reduce(
      (sum, line) => {
        return sum + (line.unitPrice.amount * line.quantity);
      },
      0
    );

    return raw * 0.9;
  }
);

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
const rawTotal = aboxFixtures.order.items.reduce(
  (sum, line) => {
    return sum + (line.unitPrice.amount * line.quantity);
  },
  0
);

const expected = rawTotal * 0.9;

console.assert(Math.abs((order as { 'derivedTotal': number }).derivedTotal - expected) < 0.005);

// Cleanup.
bookstoreEntities.removeComputed(OrderSchema, 'derivedTotal');
