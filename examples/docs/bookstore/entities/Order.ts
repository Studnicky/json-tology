import { CustomerIdSchema } from './CustomerId.js';
import { CurrencyCodeSchema } from './CurrencyCode.js';
import { Iso8601Schema } from './Iso8601.js';
import { MoneySchema } from './Money.js';
import { OrderIdSchema } from './OrderId.js';

export const OrderSchema = {
  '$id': 'urn:bookstore:Order',
  'properties': {
    'currency': {
      '$ref': CurrencyCodeSchema.$id,
      'default': 'USD'
    },
    'customerId': { '$ref': CustomerIdSchema.$id },
    'id': { '$ref': OrderIdSchema.$id },
    'items': {
      'items': { '$ref': 'urn:bookstore:OrderLine' },
      'minItems': 1,
      'type': 'array'
    },
    'placedAt': { '$ref': Iso8601Schema.$id },
    'total': { '$ref': MoneySchema.$id }
  },
  'required': [
    'id',
    'customerId',
    'items',
    'total',
    'placedAt'
  ],
  'type': 'object'
} as const;
