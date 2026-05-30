/**
 * register — Example 2: post-construction registration
 * Demonstrates: set() fluent chaining, array registration
 *
 * Uses a permissive doc-registry so demo schemas with inline shapes
 * can be added without triggering the strict-graph gate.
 */

import {
  AddressSchema, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

// Post-construction registration
jt.set(AddressSchema).set(CustomerSchema);

// Or register an array:
jt.set([
  AddressSchema,
  CustomerSchema
] as const);

console.assert(jt.registry.has(AddressSchema.$id), 'AddressSchema should be registered');
console.assert(jt.registry.has(CustomerSchema.$id), 'CustomerSchema should be registered');

console.log('AddressSchema registered:', jt.registry.has(AddressSchema.$id));
console.log('CustomerSchema registered:', jt.registry.has(CustomerSchema.$id));
console.log('registered schema count:', jt.registry.size);
