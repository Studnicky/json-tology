/**
 * Picking a method: validate — structured errors without a throw
 *
 * `validate` returns a `ValidationErrors` collection. Use it when you
 * want to inspect or log errors without catching exceptions — logging
 * pipelines, analytics, audit trails, progressive form validation.
 *
 * An empty collection (`errors.ok === true`) means valid.
 * A non-empty collection carries structured error items with `keyword`,
 * `path`, and `message` fields.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Valid order — empty collection, ok === true.
const errors = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

console.assert(errors.length === 0);

// Invalid order — missing required `orderId`.
const invalid = {
  'customerId': aboxFixtures.customer.customerId,
  'orderLines': aboxFixtures.order.orderLines,
  'orderTotal': aboxFixtures.order.orderTotal,
  'placedAt': aboxFixtures.order.placedAt,
  'shippingAddress': aboxFixtures.order.shippingAddress
};
const invalidErrors = bookstoreEntities.validate(OrderSchema.$id, invalid);

// `orderId` is required — at least one error reported.
console.assert(invalidErrors.length > 0);
