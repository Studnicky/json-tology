/**
 * instantiate — Example 3: Coerce a nested schema with $ref (Order → OrderLine)
 * Demonstrates: nested coercion via $ref, unknown field stripping at each level
 *
 * Bastian Balthazar Bux orders a single copy of the 1979 first edition.
 * The `extra` field on the OrderLine is stripped; `unexpectedField` on Order
 * is also stripped. Total matches invariant (850 × 1 = 850).
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema.$id, {
  'customerId': aboxFixtures.customer.id,
  'id': aboxFixtures.order.id,
  'items': [{
    // unknown field — stripped from OrderLine
    'bookIsbn': aboxFixtures.rareBook.isbn,
    'extra': 'gone',
    'quantity': 1,
    'unitPrice': aboxFixtures.rareBook.price
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': aboxFixtures.order.shippingAddress,
  // 850 EUR × 1 — satisfies invariant
  'total': aboxFixtures.rareBook.price,
  // unknown field — stripped from Order
  'unexpectedField': 'stripped'
});

console.assert(order.items.length === 1);
console.assert(!('extra' in order.items[0]));
console.assert(!('unexpectedField' in order));
