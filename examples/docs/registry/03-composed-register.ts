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
  'https://bookstore.example/BookSummary'
);

jt.set(BookSummarySchema);

console.assert(
  jt.registry.has('https://bookstore.example/BookSummary'),
  'BookSummarySchema should be registered'
);
