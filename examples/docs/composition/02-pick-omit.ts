/**
 * Compose.pick / omit — Example 1: BookSummary and PublicBook
 * Demonstrates: pick keeps fields, omit removes fields, required adjusted
 *
 * Book is now a Compose.subClassOf(BibliographicRecordSchema, …) — it is an
 * allOf composition, so `Compose.pick` sees only Book's OWN (retail) keys:
 * annotations, inStock, price, printStatus, ratings, stockLevel. Bibliographic
 * fields (isbn, title, authors, publishedOn) live on BibliographicRecordSchema.
 *
 * Pick the bibliographic summary from BibliographicRecordSchema; omit the
 * inventory field from BookSchema (retail view). Both lessons remain intact.
 *
 * Derived schemas register onto the canonical bookstore via
 * `jt.set()`. Every validate/instantiate call goes
 * through the same registry the rest of the docs reference, using
 * the canonical Bastian-orders-Neverending-Story fixture data.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, BibliographicRecordSchema, BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// pick — select only the bibliographic identity fields from BibliographicRecordSchema.
// isbn and title are NOT on BookSchema's own properties (they live on the base),
// so we target the base schema directly.
const BookSummarySchema = Compose.pick(
  BibliographicRecordSchema,
  [
    'isbn',
    'title'
  ] as const,
  'https://bookstore.example/BookSummary'
);

// omit — derive a public-facing Book view by removing the operational inventory field.
const PublicBookSchema = Compose.omit(
  BookSchema,
  ['inStock'] as const,
  'https://bookstore.example/PublicBook'
);

const jt2 = jt.set(BookSummarySchema).set(PublicBookSchema);

// BookSummary — only picked fields survive
const summary = jt2.instantiate(BookSummarySchema, {
  'isbn': aboxFixtures.rareBook.isbn,
  'title': aboxFixtures.rareBook.title
});

console.assert(!('authors' in summary));
console.assert(summary.isbn === aboxFixtures.rareBook.isbn);
console.log('BookSummary picked keys:', Object.keys(summary));

// PublicBook — inStock removed, printStatus still required
const pub = jt2.validate(PublicBookSchema.$id, {
  'authors': aboxFixtures.rareBook.authors,
  'isbn': aboxFixtures.rareBook.isbn,
  'price': aboxFixtures.rareBook.price,
  'printStatus': aboxFixtures.rareBook.printStatus,
  'title': aboxFixtures.rareBook.title
});

console.assert(pub.length === 0);
console.log('PublicBook valid without inStock:', pub.length === 0, '| omitted inStock from properties');
