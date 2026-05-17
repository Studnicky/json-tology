import { Compose } from '../../../src/index.js';
import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const BookSummarySchema = Compose.pick(
  BookSchema,
  [
    'isbn',
    'title',
    'price'
  ] as const,
  'https://bookstore.example/BookSummary'
);

bookstoreEntities.set(BookSummarySchema);

console.assert(
  bookstoreEntities.registry.has('https://bookstore.example/BookSummary'),
  'BookSummarySchema should be registered'
);
