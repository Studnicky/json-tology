/**
 * Value.diff — Example 1: Detect changes, replay changeset
 * Demonstrates: operations array, isEmpty
 *
 * Bastian Balthazar Bux updates the email on their customer record from
 * the old antiquariat-era address to a more formal contact.
 */

import {
  Operations, Value
} from '../../../src/index.js';
import type { Customer } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const before = bookstoreEntities.instantiate(CustomerSchema.$id, aboxFixtures.customer);

const after = bookstoreEntities.instantiate(CustomerSchema.$id, {
  ...aboxFixtures.customer,
  'email': 'bastian.balthazar.bux@bookstore.example'
});

const changes = Value.diff(before, after);

console.assert(!changes.isEmpty);
console.assert(changes.length > 0);
console.assert(changes.operations.some((op) => {
  return op.path === '/email';
}));

// Replay each operation to reconstruct the after value.
let reconstructed: unknown = Operations.clone(before);

for (const operation of changes.operations) {
  reconstructed = Operations.patch(reconstructed, operation);
}

console.assert((reconstructed as Customer).email === 'bastian.balthazar.bux@bookstore.example');
