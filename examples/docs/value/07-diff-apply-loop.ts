/**
 * Operations.patch — Tip: Apply full changeset via loop (not .apply())
 * Demonstrates: the preferred pattern for replaying all operations
 *
 * The project lint rules block direct calls to methods named .apply() to
 * prevent accidental Function.prototype.apply use. Loop over .operations
 * and call Operations.patch() on each. The Bastian Balthazar Bux order
 * fixture gains a new line item; the loop reconstructs the after state.
 */

import {
  Operations, Value
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const before = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

const updatedTotal = {
  'amount': aboxFixtures.order.orderTotal.amount + 12.99,
  'currency': 'EUR'
};

const after = bookstoreEntities.instantiate(OrderSchema, {
  ...aboxFixtures.order,
  'orderLines': [
    ...aboxFixtures.order.orderLines,
    // Cornelia Funke — Tintenherz (Cecilie Dressler Verlag, 2003)
    {
      'bookIsbn': '9783791504100',
      'quantity': 1,
      'unitPrice': {
        'amount': 12.99,
        'currency': 'EUR'
      }
    }
  ],
  'orderTotal': updatedTotal
});

const changes = Value.diff(before, after);

// ✓ Correct pattern: loop over .operations, call Operations.patch each time.
let result: unknown = Operations.clone(before);

for (const op of changes.operations) {
  result = Operations.patch(result, op);
}

const resultTotal = (result as { 'orderTotal': { 'amount': number } }).orderTotal.amount;

console.assert(Math.abs(resultTotal - updatedTotal.amount) < 0.001);

console.log('operations applied:', changes.operations.length);
console.log('patched orderTotal:', resultTotal);
