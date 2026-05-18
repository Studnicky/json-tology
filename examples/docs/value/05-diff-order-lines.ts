/**
 * Value.diff — Example 2: Track order line additions
 * Demonstrates: diff detects new items array entry, operations report the paths
 *
 * Bastian Balthazar Bux's order for the 1979 Thienemann Neverending Story
 * gains a second line — a Walter Moers paperback. The diff reports the two
 * changed paths: the new items entry and the updated total.
 */

import {
  Operations, Value
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const beforeOrder = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

const moersPrice = 24.9;

const afterOrder = bookstoreEntities.instantiate(OrderSchema, {
  ...aboxFixtures.order,
  'items': [
    ...aboxFixtures.order.items,
    // Walter Moers — Die Stadt der Träumenden Bücher (Piper, 2004).
    {
      'bookIsbn': '9783492045490',
      'quantity': 1,
      'unitPrice': {
        'amount': moersPrice,
        'currency': 'EUR'
      }
    }
  ],
  'total': {
    'amount': aboxFixtures.order.total.amount + moersPrice,
    'currency': 'EUR'
  }
});

const changes = Value.diff(beforeOrder, afterOrder);

console.assert(!changes.isEmpty);
// At minimum: new items[1] entry and updated total
console.assert(changes.length >= 2);

// Replay the changeset to reconstruct afterOrder from beforeOrder.
let reconstructed: unknown = Operations.clone(beforeOrder);

for (const op of changes.operations) {
  reconstructed = Operations.patch(reconstructed, op);
}

const reconstructedTotal = (reconstructed as { 'total': { 'amount': number } }).total.amount;

console.assert(Math.abs(reconstructedTotal - (aboxFixtures.order.total.amount + moersPrice)) < 0.001);
