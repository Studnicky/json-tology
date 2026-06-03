/**
 * value.create — Example 3: Contrast with materialize and Compose.getDefaults
 * Demonstrates: three construction paths with distinct semantics
 *
 * Shows the difference between value.create (zero-values + defaults),
 * Compose.getDefaults (declared defaults only), and materialize (partial
 * trusted data + defaults). The canonical Neverending Story rare-book
 * fixture provides the required fields for materialize.
 *
 * value.create on an allOf-composed schema (Compose.subClassOf):
 *   Traverses all allOf members, resolves $ref parents recursively,
 *   synthesizes zero-values for required fields, and applies declared
 *   defaults. The result carries inherited + own fields merged.
 *
 * Compose.getDefaults on an allOf-composed schema:
 *   Traverses inline allOf members that carry properties. $ref-only members
 *   are skipped (no registry available for resolution). Returns declared
 *   defaults from all reachable inline members merged.
 */

import {
  Compose
} from '../../../src/index.js';
import {
  aboxFixtures, BibliographicRecordSchema, BookSchema, bookstoreEntities
} from '../bookstore/index.js';
import type { Book } from '../bookstore/index.js';

// value.create on BookSchema — allOf-composed (Compose.subClassOf).
// Inherits isbn/title/authors from BibliographicRecordSchema via $ref,
// adds own retail fields, and applies inStock: true declared default.
const fromCreate = bookstoreEntities.value.create(BookSchema.$id) as Record<string, unknown>;

// Inherited required fields synthesized with zero-values
console.assert(fromCreate.isbn === '');
console.assert(fromCreate.title === '');
console.assert(Array.isArray(fromCreate.authors));

// Own field with declared default applied
console.assert(fromCreate.inStock === true);

// BibliographicRecordSchema is flat — behavior unchanged.
const fromBiblio = bookstoreEntities.value.create(BibliographicRecordSchema.$id) as Record<string, unknown>;

console.assert(fromBiblio.isbn === '');
console.assert(fromBiblio.title === '');

// Compose.getDefaults — only declared defaults (no zero-values).
// BookSchema allOf member body carries inStock: {default: true};
// the $ref-pointing allOf member (BibliographicRecord) has no defaults.
const defaults = Compose.getDefaults(BookSchema);

console.assert(defaults.inStock === true);

// BibliographicRecord has no declared defaults on any property.
const bibDefaults = Compose.getDefaults(BibliographicRecordSchema);

console.assert(!('isbn' in bibDefaults));
console.assert(!('title' in bibDefaults));
console.assert(!('authors' in bibDefaults));

// materialize — fill declared defaults, partial is trusted, throws if required missing.
// Works correctly with composed schemas; resolves inherited + own required fields.
// materialize resolves inherited + own required fields at runtime; the static
// MaterializedSchemaType surfaces own properties only, so view the result as the
// fully-resolved Book to read the inherited `isbn` precisely.
const materialized = bookstoreEntities.materialize(BookSchema, {
  'authors': aboxFixtures.rareBook.authors,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
}) as Book;

console.assert(materialized.isbn === aboxFixtures.rareBook.isbn);
console.assert(materialized.inStock === true);

console.log('create isbn (zero-value):', fromCreate.isbn);
console.log('create inStock (default applied):', fromCreate.inStock);
console.log('getDefaults inStock (declared):', defaults.inStock);
console.log('getDefaults BibliographicRecord keys (none declared):', Object.keys(bibDefaults));
console.log('materialize isbn (from data):', materialized.isbn);
console.log('materialize inStock (default true applied):', materialized.inStock);
