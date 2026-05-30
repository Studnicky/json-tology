/**
 * ValidationErrors — Example 1: Check validity, iterate errors
 * Demonstrates: .ok, .length, for...of iteration, .path, .keyword, .message, .params
 *
 * An Order with a negative total and an empty items array violates
 * `exclusiveMinimum` and `minItems` — surfaces at least two structured errors.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(OrderSchema.$id, {
  'customerId': aboxFixtures.customer.customerId,
  'orderId': aboxFixtures.order.orderId,
  // minItems: 1 violated
  'orderLines': [],
  'orderTotal': {
    // exclusiveMinimum: 0 violated
    'amount': -5,
    'currency': 'EUR'
  },
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': aboxFixtures.order.shippingAddress
});

console.assert(!errs.ok);
console.assert(errs.length >= 2);

console.log('ok:', errs.ok, ', error count:', errs.length);

for (const err of errs) {
  console.assert(typeof err.path === 'string');
  console.assert(typeof err.keyword === 'string');
  console.assert(typeof err.message === 'string');
  console.assert(typeof err.params === 'object');
  console.log(`  path="${err.path}" keyword="${err.keyword}" message="${err.message}"`);
}
