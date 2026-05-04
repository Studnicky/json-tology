/**
 * value.cast / clean / convert — Example 1: Schema-aware value operations
 * Demonstrates: type coercion, unknown stripping, convert without defaults
 */

import { JsonTology } from '../../../src/index.js';
import {
  AmountSchema, AuthorNameSchema, BookSchema, CurrencyCodeSchema, CustomerNameSchema,
  IsbnSchema, MoneySchema, TitleSchema
} from '../bookstore/index.js';

const localJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'castTypes': true,
  'schemas': [
    AmountSchema,
    CustomerNameSchema,
    AuthorNameSchema,
    CurrencyCodeSchema,
    IsbnSchema,
    MoneySchema,
    TitleSchema,
    BookSchema
  ] as const
});

// cast coerces types and fills defaults
const casted = localJt.value.cast(BookSchema.$id, {
  'authors': ['Fyodor Dostoevsky'],
  'inStock': 'true',
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'title': 'Crime and Punishment'
});

console.assert((casted as { 'price': { 'amount': number } }).price.amount === 14.99);

// clean strips unknown properties
const dirty = {
  '_cacheKey': 'k:9780140449136',
  '_internalId': 'int-001',
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'title': 'Crime and Punishment'
};
const cleaned = localJt.value.clean(BookSchema.$id, dirty);

console.assert(!('_internalId' in (cleaned as object)));
console.assert(!('_cacheKey' in (cleaned as object)));

// convert coerces types only — no defaults applied
const converted = localJt.value.convert(BookSchema.$id, {
  'authors': ['Fyodor Dostoevsky'],
  'isbn': '9780140449136',
  'price': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'title': 'Crime and Punishment'
});

console.assert(typeof (converted as { 'price': { 'amount': number } }).price.amount === 'number');
