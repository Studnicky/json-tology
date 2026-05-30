/**
 * Compose.getDefaults — Anti-pattern: Treating defaults as a full instance
 *
 * `getDefaults` returns only declared defaults — never synthesised
 * zero-values for required fields. For a blank-but-valid Customer
 * scaffold, use `bookstoreEntities.value.create` instead.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// ✓ Do this — value.create synthesises zero-values for required fields,
//   along with declared defaults (here, `addresses: []`).
const blank = bookstoreEntities.value.create(CustomerSchema.$id) as Record<string, unknown>;

console.assert(Array.isArray(blank.addresses));
console.assert(typeof blank.customerId === 'string');
console.assert(typeof blank.email === 'string');
console.assert(typeof blank.name === 'string');
console.log('value.create synthesises all required fields:', {
  'addresses': blank.addresses,
  'customerId': blank.customerId,
  'email': blank.email,
  'name': blank.name
});
