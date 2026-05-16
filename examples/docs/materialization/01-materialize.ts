/**
 * materialize — Example 1: Build a Book from partial data with defaults
 * Demonstrates: defaults filled, missing fields absent, vs value.create
 */

import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// Materialize with required fields supplied — defaults filled automatically
const book = bookstoreEntities.materialize(BookSchema, {
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'printStatus': 'inPrint',
  'title': 'Crime and Punishment'
});

console.assert(book.inStock === true);
console.assert(book.isbn === '9780140449136');

// value.create synthesizes zero-values for ALL required fields + explicit defaults
const blank = bookstoreEntities.value.create(BookSchema.$id);

console.assert((blank as { 'isbn': string }).isbn === '');
