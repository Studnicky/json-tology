/**
 * addComputed / removeComputed — Example 1: Order total computed from lines
 * Demonstrates: entities:computed marker, computeds at construction, coerce triggers fn
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/index.js';
import {
  IsbnSchema, MoneySchema, OrderLineSchema,
  QuantitySchema
} from '../bookstore/index.js';

const ComputedOrderSchema = {
  '$id': 'https://bookstore.example/ComputedOrder',
  'properties': {
    'customerId': {
      'format': 'uuid',
      'type': 'string'
    },
    'id': {
      'format': 'uuid',
      'type': 'string'
    },
    'items': {
      'items': { '$ref': 'urn:bookstore:OrderLine' },
      'minItems': 1,
      'type': 'array'
    },
    'placedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'total': {
      'entities:computed': true,
      'type': 'number'
    }
  },
  'required': [
    'id',
    'customerId',
    'items',
    'placedAt'
  ],
  'type': 'object'
} as const;

type ComputedOrder = InferType<typeof ComputedOrderSchema>;

const entities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'computeds': {
    'https://bookstore.example/ComputedOrder': {
      'total': (order) => {
        const typed = order as ComputedOrder;

        return (typed.items as Array<{
          'quantity': number;
          'unitPrice': {
            'amount': number;
            'currency': string;
          };
        }>)
          .reduce((sum, line) => {
            return sum + line.unitPrice.amount * line.quantity;
          }, 0);
      }
    }
  },
  'schemas': [
    IsbnSchema,
    MoneySchema,
    QuantitySchema,
    OrderLineSchema,
    ComputedOrderSchema
  ] as const
});

const order = entities.instantiate(ComputedOrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [
    {
      'bookIsbn': '9780140449136',
      'quantity': 2,
      'unitPrice': {
        'amount': 12.99,
        'currency': 'USD'
      }
    },
    {
      'bookIsbn': '9780062316110',
      'quantity': 1,
      'unitPrice': {
        'amount': 9.99,
        'currency': 'USD'
      }
    }
  ],
  'placedAt': '2026-01-15T10:30:00Z'
  // total is omitted — computed from items
});

const expectedTotal = 2 * 12.99 + 1 * 9.99;

console.assert(Math.abs((order as { 'total': number }).total - expectedTotal) < 0.001);
