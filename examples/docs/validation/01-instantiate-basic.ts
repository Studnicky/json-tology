/**
 * coerce — Example 1: Validate and apply defaults
 * Demonstrates: valid input, defaults filled, unknowns stripped
 *
 * Uses the canonical Bastian Balthazar Bux customer fixture, with one
 * unknown property added inline so the smoke test sees stripping work.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.instantiate(CustomerSchema.$id, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'internalNotes': 'vip',
  'name': aboxFixtures.customer.name
  // addresses omitted — default [] will be applied
});

// customer is typed as Customer
console.assert(customer.name === aboxFixtures.customer.name);
console.assert(Array.isArray(customer.addresses));
console.assert(customer.addresses.length === 0);
console.assert(!('internalNotes' in customer));
