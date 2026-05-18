/**
 * bookstoreEntities.dump — Example 1: Wire-form serialization with options
 * Demonstrates: excludeDefaults, include, basic dump
 *
 * The book is Cornelia Funke's Tintenherz (Cecilie Dressler Verlag, 2003) —
 * a contemporary German children's classic shelved alongside the
 * Neverending Story rare-book fixture in Coreander's bookshop.
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const book = bookstoreEntities.instantiate(BookSchema, {
  'authors': ['Cornelia Funke'],
  'isbn': '9783791504650',
  'price': {
    'amount': 19.95,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Tintenherz'
  // inStock defaults to true
});

// Basic dump — all fields including defaults.
const wire = bookstoreEntities.dump(BookSchema.$id, book);

console.assert(typeof wire === 'object' && wire !== null);
console.assert((wire as { 'inStock': boolean }).inStock);

// excludeDefaults — drops inStock:true.
const compact = bookstoreEntities.dump(BookSchema.$id, book, { 'excludeDefaults': true });

console.assert(!('inStock' in (compact as object)));

// include — projection to specific fields.
const projected = bookstoreEntities.dump(BookSchema.$id, book, {
  'include': [
    'isbn',
    'title',
    'price'
  ]
});

console.assert('isbn' in (projected as object));
console.assert(!('authors' in (projected as object)));
