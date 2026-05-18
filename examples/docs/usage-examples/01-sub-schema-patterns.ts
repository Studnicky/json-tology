/**
 * Sub-schema patterns — Example 1: $ref-reach behaviours
 *
 * Demonstrates how validation, instantiation, and serialization reach
 * through `$ref`-composed sub-schemas in the canonical bookstore. Every
 * call goes through `bookstoreEntities` so the runtime walks the same
 * graph the docs describe.
 *
 * Threaded narrative: Bastian Balthazar Bux's customer record, composed
 * of CustomerId + Email + PersonName + Address primitives via `$ref`.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// 1. Validation reaches into $ref'd primitives.
const okErrs = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

console.assert(okErrs.length === 0);

// A malformed email surfaces a `format` error at the parent slot path.
const badErrs = [...bookstoreEntities.validate(CustomerSchema.$id, {
  ...aboxFixtures.customer,
  'email': 'not-an-email'
})];

const formatErr = badErrs.find((err) => {
  return err.keyword === 'format' && err.path === '/email';
});

console.assert(formatErr !== undefined);

// 2. Defaults from $ref'd primitives flow through instantiate.
const created = bookstoreEntities.instantiate(CustomerSchema.$id, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
  // addresses omitted — default `[]` from CustomerSchema
}) as { 'addresses': readonly unknown[] };

console.assert(Array.isArray(created.addresses) && created.addresses.length === 0);

// 3. Dump round-trips through the same $ref graph.
const wire = bookstoreEntities.dump(CustomerSchema.$id, aboxFixtures.customer);

console.assert(typeof wire === 'object' && wire !== null);
