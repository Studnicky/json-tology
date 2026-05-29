/**
 * materialize — Example 2: Materialize a Customer — addresses default is empty array
 * Demonstrates: declared default [] applied automatically, partial is trusted
 *
 * Bastian Balthazar Bux registers with the bookstore without supplying an
 * addresses list — the declared default [] is filled in automatically by
 * materialize().
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.materialize(CustomerSchema, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
  // addresses omitted — declared default [] applied
});

// Declared default [] is applied automatically.
console.assert(Array.isArray(customer.addresses));
console.assert(customer.addresses.length === 0);
console.assert(customer.email === aboxFixtures.customer.email);
