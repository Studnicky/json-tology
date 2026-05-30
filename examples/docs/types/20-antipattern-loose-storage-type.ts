/**
 * Anti-pattern: Using `LooseInputType<T>` as a permanent storage type.
 *
 * Storage types should carry brands so every reader downstream sees
 * the validation guarantee preserved in the type. Use the branded
 * `InferType<T>` for storage; reach for `LooseInputType<T>` only at
 * the raw-input boundary.
 */

import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';
import type { CustomerSchema } from '../bookstore/index.js';

// ⊥ Don't do this — storage loses the brand guarantees.
type StoredCustomerLoose = LooseInputType<InferType<typeof CustomerSchema>>;

// ✓ Do this — storage retains the branded type.
type StoredCustomer = InferType<typeof CustomerSchema>;

const stored: StoredCustomer = {
  'addresses': [],
  'customerId': '09f8e7d6-c5b4-4321-9876-543210fedcba',
  'email': 'bastian@neverending.example',
  'name': 'Bastian Balthazar Bux'
};
const widened: StoredCustomerLoose = stored;

console.assert(typeof widened === 'object');
