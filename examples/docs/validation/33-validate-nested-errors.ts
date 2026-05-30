/**
 * validate — Example 2: Nested schema errors with JSON Pointer paths
 * Demonstrates: $ref resolution, paths like /total/amount and /items/0/quantity
 *
 * An Order with a negative total and a zero-quantity item — both nested under
 * $ref'd schemas — surfaces full JSON Pointer paths in the error items.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(OrderSchema.$id, {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': aboxFixtures.order.orderId,
  'orderLines': [{
    'bookIsbn': aboxFixtures.rareBook.isbn,
    // minimum: 1 violated
    'quantity': 0,
    'unitPrice': {
      'amount': 12.99,
      'currency': 'EUR'
    }
  }],
  'orderTotal': {
    // exclusiveMinimum: 0 violated
    'amount': -5,
    'currency': 'EUR'
  },
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': aboxFixtures.order.shippingAddress
});

const messages = errs.items.map((err) => {
  return `${err.path}: ${err.message}`;
});

console.assert(!errs.ok);
console.assert(messages.length >= 2);
// At least one error should reference a nested JSON Pointer path
console.assert(messages.some((msg) => {
  return msg.includes('/total') || msg.includes('/items');
}));
