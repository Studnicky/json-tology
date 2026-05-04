/**
 * materialize — Example 1: Build a Book from partial data with defaults
 * Demonstrates: defaults filled, missing fields absent, vs value.create
 */

import {
  BookSchema, bookstoreJt
} from '../bookstore/index.js';

// Materialize with required fields supplied — defaults filled automatically
const book = bookstoreJt.materialize(BookSchema, {
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': 14.99,
  'title': 'Crime and Punishment'
});

console.assert(book.currency === 'USD');
console.assert(book.inStock === true);
console.assert(book.isbn === '9780140449136');

// value.create synthesizes zero-values for ALL required fields + explicit defaults
const blank = bookstoreJt.value.create(BookSchema.$id);

console.assert((blank as { 'isbn': string }).isbn === '');
console.assert((blank as { 'currency': string }).currency === 'USD');
