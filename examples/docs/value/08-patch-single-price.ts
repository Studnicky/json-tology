/**
 * Operations.patch — Example 1: Apply a single price update
 * Demonstrates: patch with op:'set', original unchanged, result has new value
 *
 * The canonical rare book fixture price is updated from €850 to €795
 * via a single patch operation. The original book object is cloned first so
 * the source is not mutated.
 */

import {
  Operations
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, RareBookSchema
} from '../bookstore/index.js';

const book = bookstoreEntities.instantiate(RareBookSchema, aboxFixtures.rareBook);

const updated = Operations.patch(Operations.clone(book), {
  'op': 'set',
  'path': '/price/amount',
  'value': 795
});

console.assert((updated as { 'price': { 'amount': number } }).price.amount === 795);
// Original is unchanged.
console.assert((book as { 'price': { 'amount': number } }).price.amount === 850);

console.log('original price:', (book as { 'price': { 'amount': number } }).price.amount);
console.log('patched price:', (updated as { 'price': { 'amount': number } }).price.amount);
