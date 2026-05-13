import type { ValidateSchemaType } from '../../../../src/types/SchemaValidation.js';
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
    // transitive: true — timestamp ordering is transitive: if order A was
    // placed before B and B before C, then A was placed before C.
    // irreflexive: true — an order cannot be placed before itself; the
    // "before" relation on timestamps is strictly irreflexive.
    // OWL 2: owl:TransitiveProperty + owl:IrreflexiveProperty on placedAt.
    'placedAt': {
      '$ref': Iso8601Schema.$id,
      'irreflexive': true,
      'transitive': true
    },
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

// Compile-time self-check: every `required` entry must be in `properties`.
const _orderShapeOk: ValidateSchemaType<typeof OrderSchema> = OrderSchema;

void _orderShapeOk;
