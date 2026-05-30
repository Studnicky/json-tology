/**
 * toSchema — Example 2: Verify a composed schema round-trips correctly
 * Demonstrates: Compose.pick, jt.set, toSchema on a derived schema
 *
 * A BookSummary schema is derived from BookSchema via Compose.pick, registered
 * with jt.set, then reconstructed to confirm it contains only
 * the picked properties.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
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
    'price'
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
console.assert(props.includes('price'), 'price should be in reconstructed properties');
console.assert(!props.includes('authors'), 'authors should not be in projected schema');
console.assert(!props.includes('inStock'), 'inStock should not be in projected schema');

// Show the reconstructed BookSummary schema with only the three picked properties
console.log('reconstructed BookSummary schema:', JSON.stringify(roundTripped, null, 2));
