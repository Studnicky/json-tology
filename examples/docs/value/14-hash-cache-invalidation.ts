/**
 * Hash.value — Example 2: Cache invalidation via content hash
 * Demonstrates: hash changes when value changes, stable when unchanged
 *
 * The canonical Bastian Balthazar Bux order is used as the tracked value.
 * After a total update the hash changes, signalling that cached views must
 * be invalidated.
 */

import {
  Hash, Operations
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);
const prevHash = Hash.value(order);

// Simulate a total update — add a second line item price.
const updatedOrder = bookstoreEntities.instantiate(OrderSchema, {
  ...aboxFixtures.order,
  'orderLines': [
    ...aboxFixtures.order.orderLines,
    // Hermann Hesse — Siddhartha (Suhrkamp, 1951)
    {
      'bookIsbn': '9783518366820',
      'quantity': 1,
      'unitPrice': {
        'amount': 12,
        'currency': 'EUR'
      }
    }
  ],
  'orderTotal': {
    'amount': aboxFixtures.order.orderTotal.amount + 12,
    'currency': 'EUR'
  }
});

const newHash = Hash.value(updatedOrder);

// Changed — cache must be invalidated.
console.assert(newHash !== prevHash);

// Cloning without mutation preserves the hash.
const cloned = Operations.clone(order);

console.assert(Hash.value(cloned) === prevHash);
