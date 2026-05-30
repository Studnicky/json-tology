/**
 * Landing page: core workflow — schema → type → validate → instantiate
 *
 * The entire core in one file: declare a schema, derive the TypeScript type,
 * create a registry, validate and instantiate. Bastian Balthazar Bux is the
 * canonical bookstore customer (from Michael Ende's *The Neverending Story*).
 */

import { JsonTology } from '../../../src/index.js';
import type { InferType } from '../../../src/types/index.js';

const CustomerSchema = {
  '$id': 'urn:landing-02:Customer',
  'properties': {
    'addresses': {
      'default': [],
      'items': { 'type': 'object' },
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

type Customer = InferType<typeof CustomerSchema>;

const jt = JsonTology.create({
  'baseIRI': 'urn:landing-02',
  // doc example with synthetic fixture schemas
  'enableStrictGraph': false,
  'schemas': [CustomerSchema] as const
});

const customer: Customer = jt.instantiate(CustomerSchema.$id, {
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
});

// Typed, validated, defaults applied.
console.assert(customer.name === 'Bastian Balthazar Bux');
console.assert(Array.isArray(customer.addresses));

console.log('customer.name:', customer.name);
console.log('customer.email:', customer.email);
console.log('customer.addresses (default):', JSON.stringify(customer.addresses));
