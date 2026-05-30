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
  'customerId': aboxFixtures.customer.customerId,
  'email': aboxFixtures.customer.email,
  'name': aboxFixtures.customer.name
  // addresses omitted — schema default is []
};

// Anti-pattern: is() does not apply defaults
// Don't do this. Passing the schema $id narrows rawBody to Customer, where
// addresses is optional — but is() never fills the default, so it is undefined.
if (bookstoreEntities.is(CustomerSchema.$id, rawBody)) {
  // rawBody.addresses is undefined here — default [] was never applied
  // Calling rawBody.addresses.forEach(...) would throw at runtime
  console.assert(rawBody.addresses === undefined || Array.isArray(rawBody.addresses));
}

// Correct approach: instantiate() to get defaults applied
const customer = bookstoreEntities.instantiate(CustomerSchema.$id, rawBody);

console.assert(Array.isArray(customer.addresses));
// addresses is always present after instantiate (default [])
