import { Compose } from '../../../src/index.js';
import {
  BookSchema, bookstoreEntities
} from '../bookstore/index.js';

const book = bookstoreEntities.registry.get(BookSchema.$id);

console.assert(book !== undefined, 'BookSchema should be retrievable');
console.assert(
  book?.properties?.price !== undefined,
  'BookSchema.properties.price should exist'
);

if (book) {
  const BookSummary = Compose.pick(
    book as typeof BookSchema,
    [
      'isbn',
      'title',
      'price'
    ] as const,
    'https://bookstore.example/BookSummary'
  );

  console.assert(typeof BookSummary.$id === 'string', 'Composed schema should have $id');
}
