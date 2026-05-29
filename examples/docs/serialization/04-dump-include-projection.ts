/**
 * dump — Example 3: Project to specific fields using include
 * Demonstrates: include option keeps only the named properties in wire output
 *
 * Michael Ende's "Die unendliche Geschichte" — only isbn, title, and price
 * are included in the projected payload; authors is omitted.
 */

import {
  aboxFixtures, BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const book = bookstoreEntities.instantiate(BookSchema.$id, {
  'authors': ['Michael Ende'],
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': 'outOfPrint',
  'title': aboxFixtures.rareBook.title
});

const listing = bookstoreEntities.dump(BookSchema.$id, book, {
  'include': [
    'isbn',
    'title',
    'price'
  ]
});

console.assert(typeof listing === 'object' && listing !== null);
console.assert('isbn' in (listing as object));
console.assert('title' in (listing as object));
console.assert('price' in (listing as object));
console.assert(!('authors' in (listing as object)));
console.assert(!('inStock' in (listing as object)));
