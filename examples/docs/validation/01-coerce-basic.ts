/**
 * coerce — Example 1: Validate and apply defaults
 * Demonstrates: valid input, defaults filled, unknowns stripped
 */

import {
  CustomerSchema, bookstoreEntities as entities
} from '../bookstore/index.js';

const customer = entities.coerce(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'internalNotes': 'vip',
  'name': 'Alice Chen'
  // addresses omitted — default [] will be applied
});

// customer is typed as Customer
console.assert(customer.name === 'Alice Chen');
console.assert(Array.isArray(customer.addresses));
console.assert(customer.addresses.length === 0);
// @ts-expect-error — internalNotes is not on Customer
// console.log(customer.internalNotes);
