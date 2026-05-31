/**
 * toSchema — Example 2: Verify a composed schema round-trips correctly
 * Demonstrates: Compose.pick, jt.set, toSchema on a derived schema
 *
 * BookSchema is an allOf composition of BibliographicRecordSchema (isbn, title,
 * authors, publishedOn) extended with retail fields (price, printStatus, etc.).
 * isbn and title live on BibliographicRecordSchema, so BookSummarySchema is
 * derived from BibliographicRecordSchema via Compose.pick. The picked schema is
 * registered with jt.set, then reconstructed via toSchema to confirm it contains
 * only the picked properties.
 */

import { Compose } from '../../../src/index.js';
import {
  BibliographicRecordSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const BookSummarySchema = Compose.pick(
  BibliographicRecordSchema,
  [
    'isbn',
    'title',
    'publishedOn'
  ] as const,
  'https://bookstore.example/BookSummaryToSchema'
);

const jt2 = jt.set(BookSummarySchema);

const roundTripped = jt2.toSchema(BookSummarySchema.$id);

console.assert(roundTripped !== undefined, 'Composed schema should be retrievable');

const rec = roundTripped as Record<string, unknown>;
const props = Object.keys(rec.properties as Record<string, unknown>);

// Only the three picked properties should appear
console.assert(props.includes('isbn'), 'isbn should be in reconstructed properties');
console.assert(props.includes('title'), 'title should be in reconstructed properties');
console.assert(props.includes('publishedOn'), 'publishedOn should be in reconstructed properties');
console.assert(!props.includes('authors'), 'authors should not be in projected schema');
console.assert(!props.includes('inStock'), 'inStock should not be in projected schema');

// Show the reconstructed BookSummary schema with only the three picked properties
console.log('reconstructed BookSummary schema:', JSON.stringify(roundTripped, null, 2));
