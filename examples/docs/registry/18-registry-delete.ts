/**
 * registry.delete — Schema removal from the registry
 * Demonstrates: delete returns true on first call, false on second (idempotent)
 *
 * A temporary schema is registered and then deleted from the canonical
 * bookstore registry. The delete operation returns true when the schema
 * exists and false when it has already been removed.
 */

import { Compose } from '../../../src/index.js';
import {
  BookSchema,
  createBookstoreDocRegistry
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Register a temporary summary schema.
const BookSummarySchema = Compose.pick(
  BookSchema,
  [
    'isbn',
    'title'
  ] as const,
  'https://bookstore.example/BookSummaryTemp'
);

jt.set(BookSummarySchema);
console.assert(jt.registry.has(BookSummarySchema.$id));

// First delete returns true.
const first = jt.registry.delete(BookSummarySchema.$id);

console.assert(first);

// Second delete returns false — already removed.
const second = jt.registry.delete(BookSummarySchema.$id);

console.assert(!second);
console.assert(!jt.registry.has(BookSummarySchema.$id));

console.log('first delete (schema existed):', first);
console.log('second delete (already removed):', second);
console.log('schema present after deletion:', jt.registry.has(BookSummarySchema.$id));
