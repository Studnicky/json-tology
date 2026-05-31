/**
 * materialize — Example 1: Build a Book from partial data with defaults
 * Demonstrates: defaults filled, missing fields absent, vs value.create
 *
 * The Book here is Michael Ende's Momo (Thienemann Verlag, 1973),
 * a sibling title to the canonical Neverending Story rare-book fixture.
 *
 * BookSchema is an allOf-composed schema (Compose.subClassOf). Both materialize
 * and value.create handle composition correctly: materialize validates and fills
 * declared defaults from partial data; value.create synthesizes a full zero-value
 * instance for all required fields across inherited and own properties.
 */

import type { Book } from '../bookstore/index.js';
import {
  BibliographicRecordSchema, BookSchema, bookstoreEntities
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
// BookSchema is allOf-composed — value.create traverses $ref parents and inline
// members, merging inherited (isbn, title, authors) with own (inStock default, etc.).
const bookBlank = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

console.assert(bookBlank.isbn === '');
console.assert(bookBlank.inStock === true);

console.log('bookBlank.isbn (zero-value from inherited BibliographicRecord):', bookBlank.isbn);
console.log('bookBlank.inStock (declared default from Book):', bookBlank.inStock);

// Flat schema — value.create works as before.
const biblioBlank = bookstoreEntities.value.create(BibliographicRecordSchema.$id) as Record<string, unknown>;

console.assert((biblioBlank as { 'isbn': string }).isbn === '');

console.log('biblioBlank.isbn (zero-value from BibliographicRecordSchema):', (biblioBlank as { 'isbn': string }).isbn);
