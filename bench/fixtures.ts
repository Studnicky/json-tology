/**
 * Shared fixtures for benchmarks.
 * Schemas are declared as const for TypeScript type inference.
 * Matching TypeBox schemas are defined for apples-to-apples comparison.
 */

import { Type } from '@sinclair/typebox';

// ---------------------------------------------------------------------------
// Simple flat schema
// ---------------------------------------------------------------------------

export const SimpleSchema = {
  '$id': 'Simple',
  'additionalProperties': false,
  'properties': {
    'active': { 'type': 'boolean' },
    'age': {
      'maximum': 150,
      'minimum': 0,
      'type': 'integer'
    },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'id': { 'type': 'integer' },
    'name': { 'type': 'string' }
  },
  'required': [
    'id',
    'name',
    'email',
    'age',
    'active'
  ],
  'type': 'object'
} as const;

export const SimpleSchemaTypebox = Type.Object({
  'active': Type.Boolean(),
  'age': Type.Integer({
    'maximum': 150,
    'minimum': 0
  }),
  'email': Type.String({ 'format': 'email' }),
  'id': Type.Integer(),
  'name': Type.String()
});

export const simpleValid = {
  'active': true,
  'age': 30,
  'email': 'alice@example.com',
  'id': 1,
  'name': 'Alice'
};

export const simpleCoercible = {
  'active': 'true',
  'age': '30',
  'email': 'alice@example.com',
  'extra': 'should be removed',
  'id': '1',
  'name': 'Alice'
};

// ---------------------------------------------------------------------------
// Nested schema
// ---------------------------------------------------------------------------

export const NestedSchema = {
  '$id': 'Order',
  'properties': {
    'createdAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'customer': {
      'properties': {
        'address': {
          'properties': {
            'city': { 'type': 'string' },
            'country': {
              "maxLength": 2,
              "minLength": 2,
              'type': 'string'
            },
            'street': { 'type': 'string' },
            'zip': {
              'pattern': '^[0-9]{5}$',
              'type': 'string'
            }
          },
          'required': [
            'street',
            'city',
            'country',
            'zip'
          ],
          'type': 'object'
        },
        'email': {
          'format': 'email',
          'type': 'string'
        },
        'id': { 'type': 'integer' },
        'name': { 'type': 'string' }
      },
      'required': [
        'id',
        'name',
        'email',
        'address'
      ],
      'type': 'object'
    },
    'items': {
      'items': {
        'properties': {
          'price': {
            'minimum': 0,
            'type': 'number'
          },
          'quantity': {
            'minimum': 1,
            'type': 'integer'
          },
          'sku': { 'type': 'string' }
        },
        'required': [
          'sku',
          'quantity',
          'price'
        ],
        'type': 'object'
      },
      'minItems': 1,
      'type': 'array'
    },
    'orderId': { 'type': 'string' },
    'status': {
      'enum': [
        'pending',
        'paid',
        'shipped',
        'delivered',
        'cancelled'
      ],
      'type': 'string'
    },
    'total': {
      'minimum': 0,
      'type': 'number'
    }
  },
  'required': [
    'orderId',
    'createdAt',
    'customer',
    'items',
    'total',
    'status'
  ],
  'type': 'object'
} as const;

export const NestedSchemaTypebox = Type.Object({
  'createdAt': Type.String({ 'format': 'date-time' }),
  'customer': Type.Object({
    'address': Type.Object({
      'city': Type.String(),
      'country': Type.String({
        'maxLength': 2,
        'minLength': 2
      }),
      'street': Type.String(),
      'zip': Type.String({ 'pattern': '^[0-9]{5}$' })
    }),
    'email': Type.String({ 'format': 'email' }),
    'id': Type.Integer(),
    'name': Type.String()
  }),
  'items': Type.Array(Type.Object({
    'price': Type.Number({ 'minimum': 0 }),
    'quantity': Type.Integer({ 'minimum': 1 }),
    'sku': Type.String()
  }), { 'minItems': 1 }),
  'orderId': Type.String(),
  'status': Type.Union([
    Type.Literal('pending'),
    Type.Literal('paid'),
    Type.Literal('shipped'),
    Type.Literal('delivered'),
    Type.Literal('cancelled')
  ]),
  'total': Type.Number({ 'minimum': 0 })
});

export const nestedValid = {
  'createdAt': '2024-01-15T10:30:00.000Z',
  'customer': {
    'address': {
      'city': 'Springfield',
      'country': 'US',
      'street': '123 Main St',
      'zip': '12345'
    },
    'email': 'bob@example.com',
    'id': 42,
    'name': 'Bob Smith'
  },
  'items': [
    {
      'price': 9.99,
      'quantity': 2,
      'sku': 'WIDGET-A'
    },
    {
      'price': 24.99,
      'quantity': 1,
      'sku': 'WIDGET-B'
    }
  ],
  'orderId': 'ORD-001',
  'status': 'pending',
  'total': 44.97
};

// ---------------------------------------------------------------------------
// Schema with defaults (for Value.parse / EntityBuilder benchmarks)
// ---------------------------------------------------------------------------

export const DefaultsSchema = {
  '$id': 'Defaults',
  'properties': {
    'active': {
      'default': true,
      'type': 'boolean'
    },
    'meta': {
      'default': {},
      'properties': {
        'createdAt': {
          'default': '2024-01-01T00:00:00.000Z',
          'type': 'string'
        },
        'version': {
          'default': 1,
          'type': 'integer'
        }
      },
      'type': 'object'
    },
    'role': {
      'default': 'user',
      'type': 'string'
    },
    'score': {
      'default': 0,
      'type': 'integer'
    },
    'tags': {
      'default': [],
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': [
    'role',
    'active',
    'score',
    'tags'
  ],
  'type': 'object'
} as const;

export const defaultsInput = { 'role': 'admin' };
