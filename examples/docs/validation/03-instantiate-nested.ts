/**
 * coerce — Example 3: Coerce nested schema with $ref (Order → OrderLine)
 * Demonstrates: nested coercion, defaults on nested schema, unknown stripping
 *
 * Bastian Balthazar Bux orders two Michael Ende titles in one transaction:
 * the canonical 1979 rare-edition Neverending Story plus a contemporary
 * Momo paperback. Total = 850 + 16.99 EUR — must satisfy the registered
 * `orderTotalMatchesItems` invariant on OrderSchema.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema.$id, {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': aboxFixtures.order.orderId,
  'orderLines': [
    {
      // Canonical rare Neverending Story fixture — 850 EUR × 1.
      'bookIsbn': aboxFixtures.rareBook.isbn,
      'extra': 'gone',
      'quantity': 1,
      'unitPrice': aboxFixtures.rareBook.price
    },
    {
      // Michael Ende, Momo — Thienemann, 1973 — 16.99 EUR × 1.
      'bookIsbn': '9783522115056',
      'quantity': 1,
      'unitPrice': {
        'amount': 16.99,
        'currency': 'EUR'
      }
    }
  ],
  // 850 × 1 + 16.99 × 1 = 866.99 — satisfies `orderTotalMatchesItems`.
  'orderTotal': {
    'amount': 866.99,
    'currency': 'EUR'
  },
  'placedAt': aboxFixtures.order.placedAt,
  'shippingAddress': aboxFixtures.order.shippingAddress,
  'unexpectedField': 'stripped'
});

console.assert(order.orderLines.length === 2);
console.assert(!('extra' in order.orderLines[0]));
console.assert(!('unexpectedField' in order));
console.assert((order.orderLines[0] as { 'bookIsbn': string }).bookIsbn === aboxFixtures.rareBook.isbn);
