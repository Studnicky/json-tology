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
  'email': 'walter.moers@bookstore.example',
  'id': 'b2c3d4e5-1111-2222-3333-444455556666',
  'name': 'Walter Moers'
});

console.assert(typeof result === 'object', 'validate returns a result object');
