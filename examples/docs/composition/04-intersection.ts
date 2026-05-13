/**
 * Compose.intersection — Example 1: AuditedOrder = Order ∩ Audit
 * Demonstrates: allOf composition, all constituent schemas must pass
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import {
  AddressSchema, AmountSchema, CityNameSchema, CountryCodeSchema,
  CurrencyCodeSchema, CustomerIdSchema, CustomerNameSchema, EmailSchema,
  IsbnSchema, Iso8601Schema, MoneySchema, OrderIdSchema,
  OrderLineSchema, OrderSchema, PostalCodeSchema, QuantitySchema,
  StreetLineSchema
} from '../bookstore/index.js';

const AuditSchema = {
  '$id': 'https://bookstore.example/Audit',
  'properties': {
    'createdAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'updatedAt': {
      'format': 'date-time',
      'type': 'string'
    }
  },
  'required': [
    'createdAt',
    'updatedAt'
  ],
  'type': 'object'
} as const;

const AuditedOrderSchema = Compose.intersection(
  [
    OrderSchema,
    AuditSchema
  ] as const,
  'https://bookstore.example/AuditedOrder'
);


const bookstoreEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    AmountSchema,
    CityNameSchema,
    CountryCodeSchema,
    CurrencyCodeSchema,
    CustomerIdSchema,
    CustomerNameSchema,
    EmailSchema,
    IsbnSchema,
    Iso8601Schema,
    MoneySchema,
    OrderIdSchema,
    PostalCodeSchema,
    QuantitySchema,
    StreetLineSchema,
    AddressSchema,
    OrderLineSchema,
    OrderSchema,
    AuditSchema,
    AuditedOrderSchema
  ] as const
});

// Missing createdAt/updatedAt — AuditSchema required fields not met
const errors = bookstoreEntities.validate(AuditedOrderSchema.$id, {
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 1,
    'unitPrice': {
      'amount': 14.99,
      'currency': 'USD'
    }
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': {
    'city': 'New York',
    'country': 'US',
    'postalCode': '10001',
    'street': '123 Main St'
  },
  'total': {
    'amount': 14.99,
    'currency': 'USD'
  }
  // createdAt and updatedAt missing
});

console.assert(errors.length > 0);

// All fields present — passes
const valid = bookstoreEntities.validate(AuditedOrderSchema.$id, {
  'createdAt': '2026-01-15T10:30:00Z',
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'items': [{
    'bookIsbn': '9780140449136',
    'quantity': 1,
    'unitPrice': {
      'amount': 14.99,
      'currency': 'USD'
    }
  }],
  'placedAt': '2026-01-15T10:30:00Z',
  'shippingAddress': {
    'city': 'New York',
    'country': 'US',
    'postalCode': '10001',
    'street': '123 Main St'
  },
  'total': {
    'amount': 14.99,
    'currency': 'USD'
  },
  'updatedAt': '2026-01-15T10:30:00Z'
});

console.assert(valid.length === 0);
