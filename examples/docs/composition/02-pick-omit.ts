/**
 * Compose.pick / omit — Example 1: BookSummary and PublicBook
 * Demonstrates: pick keeps fields, omit removes fields, required adjusted
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import {
  AuthorNameSchema, BookSchema, CurrencyCodeSchema, IsbnSchema, MoneySchema,
  TitleSchema
} from '../bookstore/index.js';

// pick — keep only catalog display fields
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

// omit — remove internal fields
const PublicBookSchema = Compose.omit(
  BookSchema,
  ['currency'] as const,
  'https://bookstore.example/PublicBook'
);


const bookstoreJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AuthorNameSchema,
    CurrencyCodeSchema,
    IsbnSchema,
    MoneySchema,
    TitleSchema,
    BookSchema,
    BookSummarySchema,
    PublicBookSchema
  ] as const
});

// BookSummary — only picked fields survive
const summary = bookstoreJt.coerce(BookSummarySchema.$id, {
  'authors': ['Dostoevsky'],
  'inStock': true,
  'isbn': '9780140449136',
  'price': 14.99,
  'title': 'Crime and Punishment'
});

console.assert(!('authors' in summary));
console.assert(summary.isbn === '9780140449136');

// PublicBook — currency removed
const pub = bookstoreJt.validate(PublicBookSchema.$id, {
  'authors': ['Dostoevsky'],
  'isbn': '9780140449136',
  'price': 14.99,
  'title': 'Crime and Punishment'
});

console.assert(pub.length === 0);
