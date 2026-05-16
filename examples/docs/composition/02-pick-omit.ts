/**
 * Compose.pick / omit — Example 1: BookSummary and PublicBook
 * Demonstrates: pick keeps fields, omit removes fields, required adjusted
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import {
  AmountSchema, AuthorNameSchema, BookAnnotationsSchema, BookRatingHistogramSchema,
  BookSchema, CurrencyCodeSchema, CustomerNameSchema,
  IsbnSchema, MoneySchema, PublicationDateSchema, StockLevelSchema, TitleSchema
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


const bookstoreEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AmountSchema,
    CustomerNameSchema,
    AuthorNameSchema,
    CurrencyCodeSchema,
    IsbnSchema,
    MoneySchema,
    TitleSchema,
    BookAnnotationsSchema,
    BookRatingHistogramSchema,
    PublicationDateSchema,
    StockLevelSchema,
    BookSchema,
    BookSummarySchema,
    PublicBookSchema
  ] as const
});

// BookSummary — only picked fields survive
const summary = bookstoreEntities.instantiate(BookSummarySchema.$id, {
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
const pub = bookstoreEntities.validate(PublicBookSchema.$id, {
  'authors': ['Dostoevsky'],
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'title': 'Crime and Punishment'
});

console.assert(pub.length === 0);
