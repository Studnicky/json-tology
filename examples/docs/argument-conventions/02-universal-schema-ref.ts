/**
 * Argument conventions: universal SchemaRef
 *
 * Every method that accepts a schema reference accepts both a string `$id`
 * and a schema object. The runtime treats them identically — string IDs
 * are looked up in the registry, schema objects are registered (idempotent)
 * then run against.
 *
 * This example calls `instantiate` and `validate` both ways to show that
 * results are identical.
 */

import type { Customer } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// By string $id — registry lookup.
const customerById: Customer = bookstoreEntities.instantiate(
  CustomerSchema.$id,
  aboxFixtures.customer
);

// By schema object — idempotent registration then run.
const customerByObj = bookstoreEntities.instantiate(
  CustomerSchema,
  aboxFixtures.customer
);

console.assert(customerById.customerId === customerByObj.customerId);
console.assert(customerById.name === customerByObj.name);

// Validate also accepts both forms.
const errsByStr = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);
const errsByObj = bookstoreEntities.validate(CustomerSchema, aboxFixtures.customer);

console.assert(errsByStr.length === 0);
console.assert(errsByObj.length === 0);
