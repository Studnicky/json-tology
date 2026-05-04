/**
 * Compose.pick / omit — Example 1: BookSummary and PublicBook
 * Demonstrates: pick keeps fields, omit removes fields, required adjusted
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import {
  AmountSchema, AuthorNameSchema, BookSchema, CurrencyCodeSchema, CustomerNameSchema,
  IsbnSchema, MoneySchema, TitleSchema
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
  ['inStock'] as const,
  'https://bookstore.example/PublicBook'
);


const entities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AmountSchema,
    CustomerNameSchema,
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
const summary = entities.coerce(BookSummarySchema.$id, {
  'authors': ['Dostoevsky'],
  'inStock': true,
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'title': 'Crime and Punishment'
});

console.assert(!('authors' in summary));
console.assert(summary.isbn === '9780140449136');

// PublicBook — inStock removed
const pub = entities.validate(PublicBookSchema.$id, {
  'authors': ['Dostoevsky'],
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'title': 'Crime and Punishment'
});

console.assert(pub.length === 0);
