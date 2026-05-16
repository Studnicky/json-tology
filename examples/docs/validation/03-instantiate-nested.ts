/**
 * coerce — Example 3: Coerce nested schema with $ref (Order → OrderLine)
 * Demonstrates: nested coercion, defaults on nested schema, unknown stripping
 */

import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [
    {
      'bookIsbn': '9780140449136',
      'extra': 'gone',
      'quantity': 2,
      'unitPrice': {
        'amount': 12.99,
        'currency': 'USD'
      }
    },
    {
      'bookIsbn': '9780062316110',
      'quantity': 1,
      'unitPrice': {
        'amount': 1,
        'currency': 'USD'
      }
    }
  ],
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': {
    'city': 'New York',
    'country': 'US',
    'postalCode': '10001',
    'street': '123 Main St'
  },
  // total = 12.99 × 2 + 1.00 × 1 = 26.98 — must match the registered
  // `orderTotalMatchesItems` invariant; tampering trips a jt:invariant error.
  'total': {
    'amount': 26.98,
    'currency': 'USD'
  },
  'unexpectedField': 'stripped'
});

console.assert(order.items.length === 2);
console.assert(!('extra' in order.items[0])); console.assert(!('unexpectedField' in order));
