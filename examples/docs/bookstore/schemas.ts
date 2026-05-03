/**
 * Bookstore domain — canonical schema definitions used by all doc examples.
 * Import from this file in every example under examples/docs/.
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/index.js';

// ──────────────────────────────────────────────
// Address
// ──────────────────────────────────────────────
export const AddressSchema = {
  '$id': 'https://bookstore.example/Address',
  'properties': {
    'city': { 'type': 'string' },
    'country': {
      'default': 'US',
      'type': 'string'
    },
    'postalCode': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': [
    'street',
    'city',
    'postalCode'
  ],
  'type': 'object'
} as const;

export type Address = InferType<typeof AddressSchema>;

// ──────────────────────────────────────────────
// Customer
// ──────────────────────────────────────────────
export const CustomerSchema = {
  '$id': 'https://bookstore.example/Customer',
  'properties': {
    'addresses': {
      'default': [],
      'items': { '$ref': 'https://bookstore.example/Address' },
      'type': 'array'
    },
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'id': {
      'format': 'uuid',
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'id',
    'email',
    'name'
  ],
  'type': 'object'
} as const;

export type Customer = InferType<typeof CustomerSchema>;

// ──────────────────────────────────────────────
// Book
// ──────────────────────────────────────────────
export const BookSchema = {
  '$id': 'https://bookstore.example/Book',
  'properties': {
    'authors': {
      'items': { 'type': 'string' },
      'minItems': 1,
      'type': 'array'
    },
    'currency': {
      'default': 'USD',
      'type': 'string'
    },
    'inStock': {
      'default': true,
      'type': 'boolean'
    },
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'price': {
      'exclusiveMinimum': 0,
      'type': 'number'
    },
    'title': { 'type': 'string' }
  },
  'required': [
    'isbn',
    'title',
    'authors',
    'price'
  ],
  'type': 'object'
} as const;

export type Book = InferType<typeof BookSchema>;

// ──────────────────────────────────────────────
// OrderLine
// ──────────────────────────────────────────────
export const OrderLineSchema = {
  '$id': 'https://bookstore.example/OrderLine',
  'properties': {
    'bookIsbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'quantity': {
      'minimum': 1,
      'type': 'integer'
    },
    'unitPrice': {
      'exclusiveMinimum': 0,
      'type': 'number'
    }
  },
  'required': [
    'bookIsbn',
    'quantity',
    'unitPrice'
  ],
  'type': 'object'
} as const;

export type OrderLine = InferType<typeof OrderLineSchema>;

// ──────────────────────────────────────────────
// Order
// ──────────────────────────────────────────────
export const OrderSchema = {
  '$id': 'https://bookstore.example/Order',
  'properties': {
    'currency': {
      'default': 'USD',
      'type': 'string'
    },
    'customerId': {
      'format': 'uuid',
      'type': 'string'
    },
    'id': {
      'format': 'uuid',
      'type': 'string'
    },
    'items': {
      'items': { '$ref': 'https://bookstore.example/OrderLine' },
      'minItems': 1,
      'type': 'array'
    },
    'placedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'total': {
      'exclusiveMinimum': 0,
      'type': 'number'
    }
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

export type Order = InferType<typeof OrderSchema>;

// ──────────────────────────────────────────────
// Review
// ──────────────────────────────────────────────
export const ReviewSchema = {
  '$id': 'https://bookstore.example/Review',
  'properties': {
    'body': {
      'minLength': 10,
      'type': 'string'
    },
    'bookIsbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'customerId': {
      'format': 'uuid',
      'type': 'string'
    },
    'id': {
      'format': 'uuid',
      'type': 'string'
    },
    'postedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'rating': {
      'maximum': 5,
      'minimum': 1,
      'type': 'integer'
    }
  },
  'required': [
    'id',
    'bookIsbn',
    'customerId',
    'rating',
    'body',
    'postedAt'
  ],
  'type': 'object'
} as const;

export type Review = InferType<typeof ReviewSchema>;

// ──────────────────────────────────────────────
// Shared jt instance — all six schemas registered
// ──────────────────────────────────────────────
export const bookstoreJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AddressSchema,
    CustomerSchema,
    BookSchema,
    OrderLineSchema,
    OrderSchema,
    ReviewSchema
  ] as const
});
