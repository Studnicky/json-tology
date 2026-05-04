/**
 * Value.clone / Value.hash — Example 1: Deep copy and deterministic hash
 * Demonstrates: clone independence, hash key-order invariance
 */

import { Value } from '../../../src/index.js';
import {
  bookstoreEntities as entities, OrderSchema
} from '../bookstore/index.js';

const order = entities.coerce(OrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 1,
    'unitPrice': 14.99
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'total': 14.99
});

// clone — deep copy; mutations don't affect original
const copy = Value.clone(order);

(copy.items as Array<{
  'bookIsbn': string;
  'quantity': number;
  'unitPrice': number;
}>).push({
  'bookIsbn': '9780062316110',
  'quantity': 1,
  'unitPrice': 9.99
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
