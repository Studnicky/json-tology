import { AddressSchema } from './Address.js';
import { CustomerIdSchema } from './CustomerId.js';
import { Iso8601Schema } from './Iso8601.js';
import { MoneySchema } from './Money.js';
import { OrderIdSchema } from './OrderId.js';
import { OrderLineSchema } from './OrderLine.js';

export const OrderSchema = {
  '$id': 'urn:bookstore:Order',
  'properties': {
    'customerId': { '$ref': CustomerIdSchema.$id },
    'id': { '$ref': OrderIdSchema.$id },
    'items': {
      'items': { '$ref': OrderLineSchema.$id },
      'minItems': 1,
      'type': 'array'
    },
    'placedAt': { '$ref': Iso8601Schema.$id },
    'shippingAddress': { '$ref': AddressSchema.$id },
    'total': { '$ref': MoneySchema.$id }
  },
  'required': [
    'id',
    'customerId',
    'items',
    'total',
    'placedAt',
    'shippingAddress'
  ],
  'type': 'object'
} as const;
