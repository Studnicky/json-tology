/**
 * value.create — Example 3: Contrast with materialize and Compose.getDefaults
 * Demonstrates: three construction paths with distinct semantics
 *
 * Shows the difference between value.create (zero-values + defaults),
 * Compose.getDefaults (declared defaults only), and materialize (partial
 * trusted data + defaults). The canonical Neverending Story rare-book
 * fixture provides the required fields for materialize.
 */

import {
  Compose
} from '../../../src/index.js';
import {
  aboxFixtures, BookSchema, bookstoreEntities
} from '../bookstore/index.js';

// value.create — zero-values + explicit defaults, ALL required fields present.
const fromCreate = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

console.assert((fromCreate as { 'isbn': string }).isbn === '');
console.assert((fromCreate as { 'title': string }).title === '');
console.assert(Array.isArray((fromCreate as { 'authors': string[] }).authors));
// inStock has a declared default of true.
console.assert((fromCreate as { 'inStock': boolean }).inStock);

// Compose.getDefaults — only declared defaults (no zero-values).
const defaults = Compose.getDefaults(BookSchema);

// isbn, title, authors, price absent — they have no declared defaults.
console.assert(!('isbn' in defaults));
console.assert(!('title' in defaults));
// inStock and currency have declared defaults.
console.assert('inStock' in defaults);

// materialize — fill declared defaults, partial is trusted, throws if required missing.
const materialized = bookstoreEntities.materialize(BookSchema, {
  'authors': aboxFixtures.rareBook.authors,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
});

console.assert((materialized as { 'isbn': string }).isbn === aboxFixtures.rareBook.isbn);
console.assert((materialized as { 'inStock': boolean }).inStock);
