/**
 * Schema-only — skip prefetch when all schemas are local.
 *
 * If all schemas are known at build time and have no external `$ref`s that
 * point outside the registered set, `JsonTology.prefetch` can be omitted
 * entirely. Pass the full transitive closure of schemas directly to
 * `JsonTology.create`.
 *
 * This is the simplest path for applications whose schemas are fully
 * self-contained or pre-bundled.
 *
 * Demonstrates: JsonTology.create without prefetch, using the canonical
 * bookstore registry.
 */

import { bookstoreEntities } from '../bookstore/index.js';
import { CustomerSchema } from '../bookstore/index.js';

// All schemas live in the canonical bookstore registry — every $ref
// (Address, Email, CityName, CountryCode, …) resolves locally without
// any loader.
const result = bookstoreEntities.validate(CustomerSchema.$id, {
  'addresses': [],
  'customerId': 'a1b2c3d4-e5f6-4890-abcd-ef1234567890',
  'email': 'walter.moers@bookstore.example',
  'name': 'Walter Moers'
});

console.assert(result.ok, 'validate returns ok result');

console.log('Schema-only (no prefetch) — validate ok:', result.ok);
console.log('ValidationErrors count:', result.items.length);
