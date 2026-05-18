/**
 * Getting started: instantiate — Coerce and validate data
 *
 * Demonstrates: instantiate returns the coerced value, applies defaults
 * Uses the canonical Bastian Balthazar Bux customer fixture.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Instantiate with fixture values; strip extra fields
const customer = bookstoreEntities.instantiate(CustomerSchema, {
  'email': aboxFixtures.customer.email,
  // Not in schema — stripped on instantiate.
  'extra': 'stripped',
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
});

// Result has expected fields
console.assert(customer.id === aboxFixtures.customer.id);
console.assert(customer.email === aboxFixtures.customer.email);
console.assert(customer.name === aboxFixtures.customer.name);

// Default value applied (addresses defaults to [])
console.assert(Array.isArray(customer.addresses));
console.assert(customer.addresses.length === 0);

// Extra field was stripped
console.assert(!('extra' in customer));
