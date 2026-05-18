/**
 * is — Anti-pattern 1: Using is() when you need the coerced (defaults-filled) value
 * Demonstrates: is() does not apply defaults; instantiate() does
 *
 * The Customer schema declares `addresses: { default: [] }`. A valid customer
 * body without addresses passes is(), but the raw object won't have the
 * default applied — only instantiate() fills it.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const rawBody = {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
  // addresses omitted — schema default is []
};

// Anti-pattern: is() does not apply defaults
// Don't do this
if (bookstoreEntities.is(CustomerSchema, rawBody)) {
  // rawBody.addresses is undefined here — default [] was never applied
  // Calling rawBody.addresses.forEach(...) would throw at runtime
  console.assert(rawBody.addresses === undefined || Array.isArray(rawBody.addresses));
}

// Correct approach: instantiate() to get defaults applied
const customer = bookstoreEntities.instantiate(CustomerSchema, rawBody);

console.assert(Array.isArray(customer.addresses));
// addresses is always present after instantiate (default [])
