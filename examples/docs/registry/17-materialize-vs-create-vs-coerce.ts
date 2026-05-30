/**
 * materialize — Example 3: Contrast with instantiate and value.create
 * Demonstrates: three distinct construction paths and their trade-offs
 *
 * Three different ways to build a Book instance from partial data. The canonical
 * Neverending Story rare-book fixture provides the required fields.
 */

import {
  aboxFixtures, BookSchema, bookstoreEntities
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
const blank = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

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
console.log('value.create isbn (zero-value):', (blank as { 'isbn': string }).isbn);
console.log('instantiate isbn:', (coerced as { 'isbn': string }).isbn);
