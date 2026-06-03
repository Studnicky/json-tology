/**
 * Getting started: InferType — derive a TypeScript type from a schema
 *
 * `InferType<T>` reads the literal types from a schema constant and
 * produces the corresponding TypeScript type at compile time. No code
 * generation, no separate declaration file. The type is derived directly
 * from the `as const` schema literal.
 *
 * Format keywords (uuid, email) produce `string & FormatBrand<'uuid'>` etc.
 * so the branded types keep domain concepts nominally distinct even though
 * their runtime representation is `string`.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';
import type { Customer } from '../bookstore/index.js';

// InferType<typeof CustomerSchema, BookstoreRefs> resolves every $ref property
// to its named branded datatype. `Customer` is that resolved type; it is
// re-exported from the bookstore index for convenience.
//
// Branded values (FormatBrand<'uuid'>, etc.) can only be produced by registry
// methods (instantiate / value.create / materialize). Hand-written literals do
// not carry the brand, so construct via instantiate.
const bastian: Customer = bookstoreEntities.instantiate(CustomerSchema, {
  'addresses': [],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
});

console.assert(bastian.name === 'Bastian Balthazar Bux');
console.assert(typeof bastian.customerId === 'string');
console.assert(typeof bastian.email === 'string');
console.assert(Array.isArray(bastian.addresses));

console.log('name:', bastian.name);
console.log('email:', bastian.email);
console.log('addresses:', (bastian.addresses ?? []).length);
