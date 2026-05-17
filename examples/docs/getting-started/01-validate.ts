/**
 * Getting started: validate — Check data against a schema
 *
 * Demonstrates: validate returns ValidationErrors (no throw, no value)
 * Uses the canonical Bastian Balthazar Bux customer fixture.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Valid customer — all required fields present
const errs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

console.assert(errs.length === 0);

// Invalid customer — missing required fields
const badCustomer = { 'email': aboxFixtures.customer.email };
const badErrs = bookstoreEntities.validate(CustomerSchema.$id, badCustomer);

console.assert(badErrs.length > 0);

// Inspect the errors
for (const err of badErrs) {
  console.assert(err.keyword === 'required');
}
