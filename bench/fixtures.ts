/**
 * Shared fixtures for benchmarks.
 * Schemas declared for json-tology, TypeBox, AJV, Zod, Valibot, and io-ts.
 */

import { Type } from '@sinclair/typebox';
import {
  Ajv, type ValidateFunction
} from 'ajv';
import addFormats from 'ajv-formats';
import {
  array as iotArray,
  boolean as iotBoolean,
  exact as iotExact,
  literal as iotLiteral,
  number as iotNumber,
  refinement as iotRefinement,
  string as iotString,
  type as iotType,
  union as iotUnion
} from 'io-ts';
import { z } from 'zod';
import {
  array as vArray, boolean as vBoolean, email as vEmail,
  integer as vInteger, isoTimestamp as vIsoTimestamp,
  length as vLength, maxValue as vMaxValue,
  minLength as vMinLength, minValue as vMinValue, number as vNumber,
  object as vObject, picklist as vPicklist, pipe as vPipe,
  regex as vRegex, strictObject as vStrictObject, string as vString

} from 'valibot';

// ---------------------------------------------------------------------------
// AJV instance (shared)
// ---------------------------------------------------------------------------

export const ajvInstance = new Ajv({ 'allErrors': true });
addFormats(ajvInstance);

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

export const SimpleSchemaZod = z.object({
  'active': z.boolean(),
  'age': z.number().int()
    .min(0)
    .max(150),
  'email': z.string().email(),
  'id': z.number().int(),
  'name': z.string()
}).strict();

export const SimpleSchemaValibot = vStrictObject({
  'active': vBoolean(),
  'age': vPipe(vNumber(), vInteger(), vMinValue(0), vMaxValue(150)),
  'email': vPipe(vString(), vEmail()),
  'id': vPipe(vNumber(), vInteger()),
  'name': vString()
});

const ioTsIntegerCodec = iotRefinement(iotNumber, (value) => {
  return Number.isInteger(value);
}, 'Integer');

const ioTsEmailCodec = iotRefinement(iotString, (value) => {
  return /^[^\s@]+@[^\s@][^\s.@]*\.[^\s@]+$/u.test(value);
}, 'Email');

const ioTsAgeCodec = iotRefinement(ioTsIntegerCodec, (value) => {
  return value >= 0 && value <= 150;
}, 'Age');

export const SimpleSchemaIoTs = iotExact(iotType({
  'active': iotBoolean,
  'age': ioTsAgeCodec,
  'email': ioTsEmailCodec,
  'id': ioTsIntegerCodec,
  'name': iotString
}));

export const ajvValidateSimple: ValidateFunction = ajvInstance.compile(SimpleSchema);

export const simpleValid = {
  'active': true,
  'age': 30,
  'email': 'alice@example.com',
  'id': 1,
  'name': 'Alice'
};

export const simpleInvalid = {
  'active': 'not-bool',
  'age': 200,
  'email': 'not-an-email',
  'id': 'not-a-number',
  'name': 42
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

// Properly decomposed nested schema (no inline objects)
export const AddressSchema = {
  '$id': 'Address',
  'properties': {
    'city': { 'type': 'string' },
    'country': {
      'maxLength': 2,
      'minLength': 2,
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
} as const;

export const CustomerSchema = {
  '$id': 'Customer',
  'properties': {
    'address': { '$ref': 'Address' },
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
} as const;

export const OrderItemSchema = {
  '$id': 'OrderItem',
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
} as const;

export const NestedSchema = {
  '$id': 'Order',
  'properties': {
    'createdAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'customer': { '$ref': 'Customer' },
    'items': {
      'items': { '$ref': 'OrderItem' },
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

// Flat version for AJV (which doesn't share our registry — needs inline objects)
const NestedSchemaAjv = {
  '$id': 'OrderAjv',
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
              'maxLength': 2,
              'minLength': 2,
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

export const NestedSchemaZod = z.object({
  'createdAt': z.string().datetime(),
  'customer': z.object({
    'address': z.object({
      'city': z.string(),
      'country': z.string().length(2),
      'street': z.string(),
      'zip': z.string().regex(/^\d{5}$/u)
    }),
    'email': z.string().email(),
    'id': z.number().int(),
    'name': z.string()
  }),
  'items': z.array(z.object({
    'price': z.number().min(0),
    'quantity': z.number().int()
      .min(1),
    'sku': z.string()
  })).min(1),
  'orderId': z.string(),
  'status': z.enum([
    'pending',
    'paid',
    'shipped',
    'delivered',
    'cancelled'
  ]),
  'total': z.number().min(0)
});

export const NestedSchemaValibot = vObject({
  'createdAt': vPipe(vString(), vIsoTimestamp()),
  'customer': vObject({
    'address': vObject({
      'city': vString(),
      'country': vPipe(vString(), vLength(2)),
      'street': vString(),
      'zip': vPipe(vString(), vRegex(/^\d{5}$/u))
    }),
    'email': vPipe(vString(), vEmail()),
    'id': vPipe(vNumber(), vInteger()),
    'name': vString()
  }),
  'items': vPipe(
    vArray(vObject({
      'price': vPipe(vNumber(), vMinValue(0)),
      'quantity': vPipe(vNumber(), vInteger(), vMinValue(1)),
      'sku': vString()
    })),
    vMinLength(1)
  ),
  'orderId': vString(),
  'status': vPicklist([
    'pending',
    'paid',
    'shipped',
    'delivered',
    'cancelled'
  ]),
  'total': vPipe(vNumber(), vMinValue(0))
});

const ioTsCountryCodec = iotRefinement(iotString, (value) => {
  return value.length === 2;
}, 'Country');

const ioTsZipCodec = iotRefinement(iotString, (value) => {
  return /^\d{5}$/u.test(value);
}, 'Zip');

const ioTsIsoDateTimeCodec = iotRefinement(iotString, (value) => {
  return !Number.isNaN(Date.parse(value));
}, 'IsoDateTime');

const ioTsPositiveNumberCodec = iotRefinement(iotNumber, (value) => {
  return value >= 0;
}, 'NonNegative');

const ioTsPositiveQuantityCodec = iotRefinement(ioTsIntegerCodec, (value) => {
  return value >= 1;
}, 'PositiveQuantity');

const ioTsAddressCodec = iotType({
  'city': iotString,
  'country': ioTsCountryCodec,
  'street': iotString,
  'zip': ioTsZipCodec
});

const ioTsCustomerCodec = iotType({
  'address': ioTsAddressCodec,
  'email': ioTsEmailCodec,
  'id': ioTsIntegerCodec,
  'name': iotString
});

const ioTsOrderItemCodec = iotType({
  'price': ioTsPositiveNumberCodec,
  'quantity': ioTsPositiveQuantityCodec,
  'sku': iotString
});

const ioTsItemsCodec = iotRefinement(iotArray(ioTsOrderItemCodec), (value) => {
  return value.length > 0;
}, 'NonEmptyItems');

const ioTsStatusCodec = iotUnion([
  iotLiteral('pending'),
  iotLiteral('paid'),
  iotLiteral('shipped'),
  iotLiteral('delivered'),
  iotLiteral('cancelled')
]);

export const NestedSchemaIoTs = iotType({
  'createdAt': ioTsIsoDateTimeCodec,
  'customer': ioTsCustomerCodec,
  'items': ioTsItemsCodec,
  'orderId': iotString,
  'status': ioTsStatusCodec,
  'total': ioTsPositiveNumberCodec
});

export const ajvValidateNested: ValidateFunction = ajvInstance.compile(NestedSchemaAjv);

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
// Schema with defaults (for coerce pipeline benchmarks)
// ---------------------------------------------------------------------------

export const DefaultsSchema = {
  '$id': 'Defaults',
  'properties': {
    'active': {
      'default': true,
      'type': 'boolean'
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

export {
  array as vArray,
  boolean as vBoolean,
  email as vEmail,
  integer as vInteger,
  isoTimestamp as vIsoTimestamp,
  length as vLength,
  literal as vLiteral,
  maxValue as vMaxValue,
  minLength as vMinLength,
  minValue as vMinValue,
  number as vNumber,
  object as vObject,
  picklist as vPicklist,
  pipe as vPipe,
  regex as vRegex,
  safeParse as vSafeParse,
  strictObject as vStrictObject,
  string as vString,
  union as vUnion
} from 'valibot';
