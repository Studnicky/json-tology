/**
 * materialize — Example 3: Contrast with instantiate and value.create
 * Demonstrates: three distinct construction paths and their trade-offs
 *
 * Three different ways to build a Book instance from partial data. The canonical
 * Neverending Story rare-book fixture provides the required fields.
 *
 * value.create on a Compose.subClassOf schema (allOf-composed) now synthesizes
 * a full instance by resolving inherited fields from each allOf member, including
 * $ref parents, and merging them with the child's own fields. Declared defaults
 * (e.g. inStock: true) are applied during synthesis.
 */

import {
  aboxFixtures, BibliographicRecordSchema, BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// materialize — fills declared defaults, partial is trusted.
const materialized = bookstoreEntities.materialize(BookSchema, {
  'authors': aboxFixtures.rareBook.authors,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
  // inStock omitted — declared default true applied
});

console.assert((materialized as { 'inStock': boolean }).inStock);

// value.create — fills ALL required fields with zero-values + explicit defaults.
// BookSchema is allOf-composed (Compose.subClassOf); value.create traverses all
// allOf members, resolves $ref parents, and merges inherited + own fields.
const bookBlank = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

// Inherited from BibliographicRecordSchema (required: isbn, title, authors)
console.assert(bookBlank.isbn === '');
console.assert(bookBlank.title === '');
console.assert(Array.isArray(bookBlank.authors));

// Own fields with declared default: inStock: true
console.assert(bookBlank.inStock === true);

// BibliographicRecordSchema is flat — value.create still works as before.
const blank = bookstoreEntities.value.create(BibliographicRecordSchema.$id) as Record<string, unknown>;

console.assert((blank as { 'isbn': string }).isbn === '');
console.assert((blank as { 'title': string }).title === '');
console.assert(Array.isArray((blank as { 'authors': string[] }).authors));

// instantiate — validates, strips unknowns, applies defaults, throws on failure.
const coerced = bookstoreEntities.instantiate(BookSchema, {
  'authors': aboxFixtures.rareBook.authors,
  'inStock': aboxFixtures.rareBook.inStock,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
});

console.assert((coerced as { 'isbn': string }).isbn === aboxFixtures.rareBook.isbn);

console.log('materialize inStock (default applied):', (materialized as { 'inStock': boolean }).inStock);
console.log('value.create(BookSchema) isbn (zero-value):', bookBlank.isbn);
console.log('value.create(BookSchema) inStock (default):', bookBlank.inStock);
console.log('value.create(BibliographicRecordSchema) isbn (zero-value):', (blank as { 'isbn': string }).isbn);
console.log('instantiate isbn:', (coerced as { 'isbn': string }).isbn);
