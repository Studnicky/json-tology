/**
 * Value.clone / Value.hash — Example 1: Deep copy and deterministic hash
 * Demonstrates: clone independence, hash key-order invariance
 */

import { Value } from '../../../src/index.js';
import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 1,
    'unitPrice': {
      'amount': 14.99,
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
    'amount': 14.99,
    'currency': 'USD'
  }
});

// clone — deep copy; mutations don't affect original
const copy = Value.clone(order);

(copy.items as Array<{
  'bookIsbn': string;
  'quantity': number;
  'unitPrice': {
    'amount': number;
    'currency': string;
  };
}>).push({
  'bookIsbn': '9780062316110',
  'quantity': 1,
  'unitPrice': {
    'amount': 9.99,
    'currency': 'USD'
  }
});
console.assert(order.items.length === 1);
console.assert(copy.items.length === 2);

// hash — deterministic, key-order invariant
const h1 = Value.hash({
  'isbn': '9780140449136',
  'title': 'Crime and Punishment'
});
const h2 = Value.hash({
  'isbn': '9780140449136',
  'title': 'Crime and Punishment'
});

console.assert(h1 === h2);
console.assert(typeof h1 === 'string' && h1.length > 0);
