/**
 * coerce — Example 3: Coerce nested schema with $ref (Order → OrderLine)
 * Demonstrates: nested coercion, defaults on nested schema, unknown stripping
 */

import {
  bookstoreJt, OrderSchema
} from '../bookstore/schemas.js';

const order = bookstoreJt.coerce(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [
    {
      'bookIsbn': '9780140449136',
      'extra': 'gone',
      'quantity': 2,
      'unitPrice': 12.99
    },
    {
      'bookIsbn': '9780062316110',
      'quantity': 1,
      'unitPrice': 1
    }
  ],
  'placedAt': '2026-01-15T10:30:00Z',
  'total': 27.98,
  'unexpectedField': 'stripped'
});

console.assert(order.currency === 'USD'); console.assert(order.items.length === 2);
console.assert(!('extra' in order.items[0])); console.assert(!('unexpectedField' in order));
