/**
 * Operations.clone / Hash.value — Example 1: Deep copy and deterministic hash
 * Demonstrates: clone independence, hash key-order invariance
 *
 * Order is the canonical Bastian-orders-Neverending-Story fixture. The
 * clone gets a second line item appended (a Walter Moers paperback)
 * without disturbing the original.
 */

import {
  Hash, Operations
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema.$id, aboxFixtures.order);

// clone — deep copy; mutations don't affect original.
const copy = Operations.clone(order);

// clone produces a deep copy — orderLines arrays are distinct references.
console.assert(order.orderLines.length === 1);
console.assert(copy.orderLines !== order.orderLines, 'clone must produce distinct orderLines reference');

// structuredClone the branded orderLines array into a plain mutable array so a new
// line item can be appended without satisfying the element brands at compile time.
// interop: branded readonly tuple → plain mutable array for the push demo;
// structuredClone strips brands at runtime, unknown intermediate satisfies tsc.
const copyItems: unknown[] = structuredClone(copy.orderLines as unknown as unknown[]);

copyItems.push({
  // Walter Moers — Die Stadt der Träumenden Bücher (Piper, 2004).
  'bookIsbn': '9783492045490',
  'quantity': 1,
  'unitPrice': {
    'amount': 24.9,
    'currency': 'EUR'
  }
});
console.assert(copyItems.length === 2);

// hash — deterministic, key-order invariant.
const h1 = Hash.value({
  'isbn': aboxFixtures.rareBook.isbn,
  'title': aboxFixtures.rareBook.title
});
const h2 = Hash.value({
  'isbn': aboxFixtures.rareBook.isbn,
  'title': aboxFixtures.rareBook.title
});

console.assert(h1 === h2);
console.assert(typeof h1 === 'string' && h1.length > 0);

console.log('original orderLines:', order.orderLines.length);
console.log('copy orderLines after push:', copyItems.length);
console.log('hash (key-order invariant):', h1);
console.log('hashes equal:', h1 === h2);
