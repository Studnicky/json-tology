/**
 * addInvariant — Example 1: Order total invariant
 * Demonstrates: canonical invariant registered on OrderSchema, validation with
 * invariant failure, and passing valid fixture
 *
 * Operates against the canonical bookstore registry. The production invariant
 * `orderTotalMatchesItems` is already registered on OrderSchema in
 * `examples/docs/bookstore/index.ts`. This example demonstrates the invariant
 * in action: rejecting a tampered total with an invariant violation error,
 * then passing the canonical Bastian fixture (which satisfies all invariants).
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

// The canonical fixture passes all invariants (structural + relational).
const validOrder = bookstoreEntities.validate(OrderSchema.$id, aboxFixtures.order);

console.assert(validOrder.ok);
console.assert(!validOrder.items.some((errItem) => {
  return errItem.keyword === 'jt:invariant';
}));

console.log('valid order result:', validOrder.ok ? 'ok' : 'invalid');
console.log('valid order error count:', validOrder.items.length);

// Now tamper with the total — claim €1000 when items sum to €850.
const tamperedOrder = {
  ...aboxFixtures.order,
  'orderTotal': {
    'amount': 1000,
    'currency': aboxFixtures.order.orderTotal.currency
  }
};

// validate() surfaces the orderTotalMatchesItems invariant failure.
const errs = bookstoreEntities.validate(OrderSchema.$id, tamperedOrder);

console.assert(!errs.ok);
console.assert(errs.items.some((errItem) => {
  return errItem.keyword === 'jt:invariant';
}));

const invariantErr = errs.items.find((errItem) => {
  return errItem.keyword === 'jt:invariant';
});

console.log('tampered order result:', errs.ok ? 'ok' : 'invalid');
console.log('invariant keyword:', invariantErr?.keyword);
console.log('invariant message:', invariantErr?.message);

// is() returns false for the tampered order.
console.assert(!bookstoreEntities.is(OrderSchema.$id, tamperedOrder));

console.log('is() on tampered order:', bookstoreEntities.is(OrderSchema.$id, tamperedOrder));
