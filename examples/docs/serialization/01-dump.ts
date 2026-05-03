/**
 * bookstoreJt.dump — Example 1: Wire-form serialization with options
 * Demonstrates: excludeDefaults, include, basic dump
 */

import {
  BookSchema, bookstoreJt
} from '../bookstore/schemas.js';

const book = bookstoreJt.coerce(BookSchema.$id, {
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': 14.99,
  'title': 'Crime and Punishment'
  // currency defaults to 'USD', inStock defaults to true
});

// Basic dump — all fields including defaults
const wire = bookstoreJt.dump(BookSchema.$id, book);

console.assert(typeof wire === 'object' && wire !== null);
console.assert((wire as { 'currency': string }).currency === 'USD');
console.assert((wire as { 'inStock': boolean }).inStock);

// excludeDefaults — drops currency:'USD' and inStock:true
const compact = bookstoreJt.dump(BookSchema.$id, book, { 'excludeDefaults': true });

console.assert(!('currency' in (compact as object)));
console.assert(!('inStock' in (compact as object)));

// include — projection to specific fields
const projected = bookstoreJt.dump(BookSchema.$id, book, {
  'include': [
    'isbn',
    'title',
    'price'
  ]
});

console.assert('isbn' in (projected as object));
console.assert(!('authors' in (projected as object)));
