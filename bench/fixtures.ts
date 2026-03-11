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
  $id: 'Simple',
  type: 'object',
  properties: {
    id:    { type: 'integer' },
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
    age:   { type: 'integer', minimum: 0, maximum: 150 },
    active: { type: 'boolean' },
  },
  required: ['id', 'name', 'email', 'age', 'active'],
  additionalProperties: false,
} as const;

export const SimpleSchemaTypebox = Type.Object({
  id:     Type.Integer(),
  name:   Type.String(),
  email:  Type.String({ format: 'email' }),
  age:    Type.Integer({ minimum: 0, maximum: 150 }),
  active: Type.Boolean(),
});

export const simpleValid = {
  id: 1,
  name: 'Alice',
  email: 'alice@example.com',
  age: 30,
  active: true,
};

export const simpleCoercible = {
  id: '1',
  name: 'Alice',
  email: 'alice@example.com',
  age: '30',
  active: 'true',
  extra: 'should be removed',
};

// ---------------------------------------------------------------------------
// Nested schema
// ---------------------------------------------------------------------------

export const NestedSchema = {
  $id: 'Order',
  type: 'object',
  properties: {
    orderId:   { type: 'string' },
    createdAt: { type: 'string', format: 'date-time' },
    customer: {
      type: 'object',
      properties: {
        id:    { type: 'integer' },
        name:  { type: 'string' },
        email: { type: 'string', format: 'email' },
        address: {
          type: 'object',
          properties: {
            street:  { type: 'string' },
            city:    { type: 'string' },
            country: { type: 'string', minLength: 2, maxLength: 2 },
            zip:     { type: 'string', pattern: '^[0-9]{5}$' },
          },
          required: ['street', 'city', 'country', 'zip'],
        },
      },
      required: ['id', 'name', 'email', 'address'],
    },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          sku:      { type: 'string' },
          quantity: { type: 'integer', minimum: 1 },
          price:    { type: 'number', minimum: 0 },
        },
        required: ['sku', 'quantity', 'price'],
      },
      minItems: 1,
    },
    total: { type: 'number', minimum: 0 },
    status: { type: 'string', enum: ['pending', 'paid', 'shipped', 'delivered', 'cancelled'] },
  },
  required: ['orderId', 'createdAt', 'customer', 'items', 'total', 'status'],
} as const;

export const NestedSchemaTypebox = Type.Object({
  orderId:   Type.String(),
  createdAt: Type.String({ format: 'date-time' }),
  customer: Type.Object({
    id:    Type.Integer(),
    name:  Type.String(),
    email: Type.String({ format: 'email' }),
    address: Type.Object({
      street:  Type.String(),
      city:    Type.String(),
      country: Type.String({ minLength: 2, maxLength: 2 }),
      zip:     Type.String({ pattern: '^[0-9]{5}$' }),
    }),
  }),
  items: Type.Array(Type.Object({
    sku:      Type.String(),
    quantity: Type.Integer({ minimum: 1 }),
    price:    Type.Number({ minimum: 0 }),
  }), { minItems: 1 }),
  total:  Type.Number({ minimum: 0 }),
  status: Type.Union([
    Type.Literal('pending'), Type.Literal('paid'), Type.Literal('shipped'),
    Type.Literal('delivered'), Type.Literal('cancelled'),
  ]),
});

export const nestedValid = {
  orderId: 'ORD-001',
  createdAt: '2024-01-15T10:30:00.000Z',
  customer: {
    id: 42,
    name: 'Bob Smith',
    email: 'bob@example.com',
    address: {
      street: '123 Main St',
      city: 'Springfield',
      country: 'US',
      zip: '12345',
    },
  },
  items: [
    { sku: 'WIDGET-A', quantity: 2, price: 9.99 },
    { sku: 'WIDGET-B', quantity: 1, price: 24.99 },
  ],
  total: 44.97,
  status: 'pending',
};

// ---------------------------------------------------------------------------
// Schema with defaults (for Value.parse / EntityBuilder benchmarks)
// ---------------------------------------------------------------------------

export const DefaultsSchema = {
  $id: 'Defaults',
  type: 'object',
  properties: {
    role:    { type: 'string', default: 'user' },
    active:  { type: 'boolean', default: true },
    score:   { type: 'integer', default: 0 },
    tags:    { type: 'array', items: { type: 'string' }, default: [] },
    meta: {
      type: 'object',
      properties: {
        createdAt: { type: 'string', default: '2024-01-01T00:00:00.000Z' },
        version:   { type: 'integer', default: 1 },
      },
      default: {},
    },
  },
  required: ['role', 'active', 'score', 'tags'],
} as const;

export const defaultsInput = { role: 'admin' };
