/**
 * validate — Example 2: Nested validation errors with JSON Pointer paths
 * Demonstrates: error paths for nested schemas (Order containing OrderLines)
 */

import {
  bookstoreJt, OrderSchema
} from '../bookstore/schemas.js';

const errors = bookstoreJt.validate(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 0,
    'unitPrice': 12.99
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'total': -5
});

console.assert(errors.length > 0);
console.assert(errors.some((errMsg) => {
  return errMsg.includes('total');
}));
console.assert(errors.some((errMsg) => {
  return errMsg.includes('quantity');
}));
