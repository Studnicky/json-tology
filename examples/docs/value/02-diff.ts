/**
 * Value.diff — Example 1: Detect changes, replay changeset
 * Demonstrates: operations array, isEmpty
 */

import { Value } from '../../../src/index.js';
import type { Customer } from '../bookstore/index.js';
import {
  CustomerSchema, bookstoreEntities as entities
} from '../bookstore/index.js';

const before = entities.instantiate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
});

const after = entities.instantiate(CustomerSchema.$id, {
  'email': 'alice.chen@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
});

const changes = Value.diff(before, after);

console.assert(!changes.isEmpty);
console.assert(changes.length > 0);
console.assert(changes.operations.some((op) => {
  return op.path === '/email';
}));

// Replay each operation to reconstruct the after value
let reconstructed: unknown = Value.clone(before);

for (const operation of changes.operations) {
  reconstructed = Value.applyOp(reconstructed, operation);
}

console.assert((reconstructed as Customer).email === 'alice.chen@bookstore.example');
