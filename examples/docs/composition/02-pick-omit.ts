/**
 * Compose.pick / omit — Example 1: BookSummary and PublicBook
 * Demonstrates: pick keeps fields, omit removes fields, required adjusted
 *
 * Derived schemas register onto the canonical bookstore via
 * `jt.set()`. Every validate/instantiate call goes
 * through the same registry the rest of the docs reference, using
 * the canonical Bastian-orders-Neverending-Story fixture data.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BookSummarySchema = Compose.pick(
  BookSchema,
  [
    'isbn',
    'title',
    'price',
    'inStock'
  ] as const,
  'https://bookstore.example/BookSummary'
);

const PublicBookSchema = Compose.omit(
  BookSchema,
  ['inStock'] as const,
  'https://bookstore.example/PublicBook'
);

jt.set(BookSummarySchema);
jt.set(PublicBookSchema);

// BookSummary — only picked fields survive
const summary = jt.instantiate(BookSummarySchema, {
  'inStock': aboxFixtures.rareBook.inStock,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'title': aboxFixtures.rareBook.title
});

console.assert(!('authors' in summary));
console.assert(summary.isbn === aboxFixtures.rareBook.isbn);

// PublicBook — inStock removed, printStatus still required
const pub = jt.validate(PublicBookSchema.$id, {
  'authors': aboxFixtures.rareBook.authors,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
});

console.assert(pub.length === 0);
