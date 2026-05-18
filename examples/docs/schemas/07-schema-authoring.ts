/**
 * Schema authoring — Example 7: minimal schema with $id and as const
 *
 * Schemas are plain JSON Schema objects. `$id` is required and must be a
 * fully-qualified IRI. `as const` is required so TypeScript preserves the
 * literal types that `InferType<T>` reads.
 *
 * The canonical bookstore uses `urn:bookstore:` IRIs. This example
 * demonstrates the minimal shape with bookstore characters as data.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// CustomerSchema follows the minimal shape: $id, type, properties, required.
const id: string = CustomerSchema.$id;

console.assert(id === 'urn:bookstore:Customer');

const schemaType: string = CustomerSchema.type;

console.assert(schemaType === 'object');
console.assert(Array.isArray(CustomerSchema.required));

// Validate Bastian Balthazar Bux against the registered schema.
const errs = bookstoreEntities.validate(CustomerSchema.$id, {
  'addresses': [],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
});

console.assert(errs.length === 0);
