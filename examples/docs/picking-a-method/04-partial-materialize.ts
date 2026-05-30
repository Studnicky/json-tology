/**
 * Picking a method: lenient partial construction with enablePartial
 *
 * `materialize` with `{ enablePartial: true }` allows missing required-
 * without-default fields. Use this for form scaffolding where only a
 * subset of fields is known at construction time — for example, starting
 * an order with only a customerId and filling items later.
 *
 * Without `enablePartial`, a missing required field would throw
 * `MaterializationError`.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// Partial construction — items and total are required in OrderSchema
// but are omitted here. enablePartial suppresses the missing-field error.
// materialize takes a schema object (not a $id string) as its first argument.
const scaffold = bookstoreEntities.materialize(
  OrderSchema,
  { 'customerId': aboxFixtures.customer.customerId },
  { 'enablePartial': true }
);

console.assert(scaffold.customerId === aboxFixtures.customer.customerId);
console.log('partial scaffold → customerId:', scaffold.customerId, '| orderId:', scaffold.orderId ?? '(not yet set)');
