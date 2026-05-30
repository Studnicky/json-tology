/**
 * materialize — Example 1: Build a Book from partial data with defaults
 * Demonstrates: defaults filled, missing fields absent, vs value.create
 *
 * The Book here is Michael Ende's Momo (Thienemann Verlag, 1973),
 * a sibling title to the canonical Neverending Story rare-book fixture.
 */

import type { Book } from '../bookstore/index.js';
import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// Materialize with required fields supplied — defaults filled automatically.
// The partial input carries plain (unbranded) literals — branding happens
// during materialization — so the result is typed via the registry's Book.
const book = bookstoreEntities.materialize(BookSchema, {
  'authors': ['Michael Ende'],
  'isbn': '9783522115056',
  'price': {
    'amount': 16.99,
    'currency': 'EUR'
  },
  'printStatus': 'inPrint',
  'title': 'Momo'
}) as Book;

console.assert(book.inStock === true);
console.assert(book.isbn === '9783522115056');
console.assert(book.title === 'Momo');

console.log('book.title:', book.title);
console.log('book.isbn:', book.isbn);
console.log('book.inStock (default):', book.inStock);
console.log('book.price:', JSON.stringify(book.price));

// value.create synthesizes zero-values for ALL required fields + explicit defaults.
const blank = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

console.assert((blank as { 'isbn': string }).isbn === '');

console.log('blank.isbn (zero-value):', (blank as { 'isbn': string }).isbn);
