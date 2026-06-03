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
// 0 — valid fixture passes
// A malformed email surfaces a `format` error at the parent slot path.
console.log('validate ok errors:', okErrs.length);
const badErrs = [...bookstoreEntities.validate(CustomerSchema.$id, {
  ...aboxFixtures.customer,
  'email': 'not-an-email'
})];

const formatErr = badErrs.find((err) => {
  return err.keyword === 'format' && err.path === '/email';
});

console.assert(formatErr !== undefined);
// /email — reached through $ref
// 2. Defaults from $ref'd primitives flow through instantiate.
console.log('format error path:', formatErr?.path);
const created = bookstoreEntities.instantiate(CustomerSchema.$id, {
  'customerId': aboxFixtures.customer.customerId,
  'email': aboxFixtures.customer.email,
  'name': aboxFixtures.customer.name
  // addresses omitted — default `[]` from CustomerSchema
});

console.assert(Array.isArray(created.addresses) && created.addresses.length === 0);
// [] — default filled via $ref
// 3. Dump round-trips through the same $ref graph. instantiate first to
console.log('addresses default:', created.addresses);
// obtain the branded value dump's typed overload expects.
const customer = bookstoreEntities.instantiate(CustomerSchema.$id, aboxFixtures.customer);
const wire = bookstoreEntities.dump(CustomerSchema.$id, customer);

console.assert('email' in wire);
// round-tripped through $ref graph
console.log('dump email:', (wire as { 'email': string }).email);
