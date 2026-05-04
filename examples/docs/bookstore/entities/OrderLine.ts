import { IsbnSchema } from './Isbn.js';
import { MoneySchema } from './Money.js';
import { QuantitySchema } from './Quantity.js';

export const OrderLineSchema = {
  '$id': 'urn:bookstore:OrderLine',
  'properties': {
    'bookIsbn': { '$ref': IsbnSchema.$id },
    'quantity': { '$ref': QuantitySchema.$id },
    'unitPrice': { '$ref': MoneySchema.$id }
  },
  'required': [
    'bookIsbn',
    'quantity',
    'unitPrice'
  ],
  'type': 'object'
} as const;
