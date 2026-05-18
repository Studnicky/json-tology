/**
 * instantiate — Anti-pattern 2: Coercing already-coerced values
 * Demonstrates: the wasteful double-instantiate vs using the first result
 *
 * Bastian Balthazar Bux — valid customer used to show that re-coercing
 * an already-coerced value is redundant work.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Anti-pattern: double instantiation — wasted work
// Don't do this
const first = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

// redundant — first is already coerced and typed
const _again = bookstoreEntities.instantiate(CustomerSchema, first);

void _again;

// Correct approach: use the first result directly
const customer = bookstoreEntities.instantiate(CustomerSchema, aboxFixtures.customer);

console.assert(customer.name === aboxFixtures.customer.name);
console.assert(customer.email === aboxFixtures.customer.email);
console.assert(Array.isArray(customer.addresses));
