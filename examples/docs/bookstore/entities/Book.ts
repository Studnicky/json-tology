import { AuthorNameSchema } from './AuthorName.js';
import { CurrencyCodeSchema } from './CurrencyCode.js';
import { IsbnSchema } from './Isbn.js';
import { MoneySchema } from './Money.js';
import { TitleSchema } from './Title.js';

export const BookSchema = {
  '$id': 'urn:bookstore:Book',
  'properties': {
    'authors': {
      'items': { '$ref': AuthorNameSchema.$id },
      'minItems': 1,
      'type': 'array'
    },
    'currency': {
      '$ref': CurrencyCodeSchema.$id,
      'default': 'USD'
    },
    'inStock': {
      'default': true,
      'type': 'boolean'
    },
    'isbn': { '$ref': IsbnSchema.$id },
    'price': { '$ref': MoneySchema.$id },
    'title': { '$ref': TitleSchema.$id }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price',
    'currency'
  ],
  'type': 'object'
} as const;
