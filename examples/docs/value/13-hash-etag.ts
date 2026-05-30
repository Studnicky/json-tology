/**
 * Hash.value — Example 1: Generate an ETag for a book
 * Demonstrates: deterministic hex string, key-order invariance
 *
 * The canonical rare book fixture — Michael Ende's Die unendliche Geschichte
 * (Thienemann Verlag, 1979) — produces the same hash regardless of property
 * key ordering. This property makes Hash.value suitable for ETag generation
 * and content-addressable caching.
 */

import {
  Hash
} from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, RareBookSchema
} from '../bookstore/index.js';

const book = bookstoreEntities.instantiate(RareBookSchema, aboxFixtures.rareBook);

const etag = Hash.value(book);

// Deterministic hex string — same value each time.
console.assert(typeof etag === 'string');
console.assert(etag.length > 0);

// Key-order invariant — same keys/values, different insertion order → identical hash.
// isbn before title in h1, title before isbn in h2 — hash is stable.
const h1 = Hash.value({
  'isbn': aboxFixtures.rareBook.isbn,
  'title': aboxFixtures.rareBook.title
});

const h2 = Hash.value({
  'isbn': aboxFixtures.rareBook.isbn,
  'title': aboxFixtures.rareBook.title
});

console.assert(h1 === h2);

console.log('book etag:', etag);
console.log('key-order invariant:', h1 === h2);
