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

(copy.items as Array<{
  'bookIsbn': string;
  'quantity': number;
  'unitPrice': {
    'amount': number;
    'currency': string;
  };
}>).push({
  // Walter Moers — Die Stadt der Träumenden Bücher (Piper, 2004).
  'bookIsbn': '9783492045490',
  'quantity': 1,
  'unitPrice': {
    'amount': 24.9,
    'currency': 'EUR'
  }
});
console.assert(order.items.length === 1);
console.assert(copy.items.length === 2);

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
