/**
 * validate — Example 2: Nested validation errors with JSON Pointer paths
 * Demonstrates: error paths for nested schemas (Order containing OrderLines)
 */

import {
  bookstoreEntities as entities, OrderSchema
} from '../bookstore/index.js';

const errors = entities.validate(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 0,
    'unitPrice': {
      'amount': 12.99,
      'currency': 'USD'
    }
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': {
    'city': 'New York',
    'country': 'US',
    'postalCode': '10001',
    'street': '123 Main St'
  },
  'total': {
    'amount': -5,
    'currency': 'USD'
  }
});

console.assert(errors.length > 0);
console.assert(errors.items.some((err) => {
  return err.path.includes('total') || err.message.includes('total');
}));
console.assert(errors.items.some((err) => {
  return err.path.includes('quantity') || err.message.includes('quantity');
}));
