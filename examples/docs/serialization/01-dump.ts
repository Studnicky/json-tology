/**
 * bookstoreEntities.dump — Example 1: Wire-form serialization with options
 * Demonstrates: excludeDefaults, include, basic dump
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const book = bookstoreEntities.instantiate(BookSchema.$id, {
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'printStatus': 'inPrint',
  'title': 'Crime and Punishment'
  // inStock defaults to true
});

// Basic dump — all fields including defaults
const wire = bookstoreEntities.dump(BookSchema.$id, book);

console.assert(typeof wire === 'object' && wire !== null);
console.assert((wire as { 'inStock': boolean }).inStock);

// excludeDefaults — drops inStock:true
const compact = bookstoreEntities.dump(BookSchema.$id, book, { 'excludeDefaults': true });

console.assert(!('inStock' in (compact as object)));

// include — projection to specific fields
const projected = bookstoreEntities.dump(BookSchema.$id, book, {
  'include': [
    'isbn',
    'title',
    'price'
  ]
});

console.assert('isbn' in (projected as object));
console.assert(!('authors' in (projected as object)));
