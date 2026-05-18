/**
 * Argument conventions: schema $id vs schema object
 *
 * Demonstrates: every method accepts either a string $id OR a schema object
 * Results are identical.
 * Uses the canonical Bastian Balthazar Bux customer fixture.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Call validate with string $id
const errsById = bookstoreEntities.validate(
  CustomerSchema.$id,
  aboxFixtures.customer
);

// Call validate with schema object
const errsByObj = bookstoreEntities.validate(
  CustomerSchema,
  aboxFixtures.customer
);

// Both produce the same result — valid customer, zero errors
console.assert(errsById.length === 0);
console.assert(errsByObj.length === 0);
console.assert(errsById.length === errsByObj.length);
