/**
 * dump — Example 2: Compact payload — exclude default-valued fields
 * Demonstrates: excludeDefaults option drops fields that equal the schema default
 *
 * Cornelia Funke's Tintenherz has `inStock: true` (schema default: true).
 * With `excludeDefaults: true`, `inStock` is omitted from the wire payload
 * because its value equals the declared default.
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const book = bookstoreEntities.instantiate(BookSchema.$id, {
  'authors': ['Cornelia Funke'],
  'isbn': '9783791504650',
  'price': {
    'amount': 19.95,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Tintenherz'
  // inStock omitted — schema default true will be filled
});

// Full dump includes inStock: true (the default was applied by instantiate)
const full = bookstoreEntities.dump(BookSchema.$id, book);

console.assert(typeof full === 'object' && full !== null);
console.assert('isbn' in (full as object));

// excludeDefaults drops inStock: true because it equals the schema default
const compact = bookstoreEntities.dump(BookSchema.$id, book, { 'excludeDefaults': true });

console.assert(typeof compact === 'object' && compact !== null);

// isbn, title, authors are required fields — always present
console.assert('isbn' in (compact as object));
console.assert('title' in (compact as object));

// inStock: true equals the schema default, so it should be absent
console.assert(!('inStock' in (compact as object)), 'inStock should be omitted (equals default)');
