/**
 * Compose.partial / required — Example 1: PATCH and strict-create schemas
 * Demonstrates: partial removes required, required makes all fields required
 *
 * Derived schemas register onto the canonical bookstore via
 * `bookstoreEntities.set()`. Inputs use the Bastian Balthazar Bux fixture
 * shared with every other doc example.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer'
);

const StrictCustomerSchema = Compose.required(
  CustomerSchema,
  'https://bookstore.example/StrictCustomer'
);

bookstoreEntities.set(PatchCustomerSchema);
bookstoreEntities.set(StrictCustomerSchema);

// PatchCustomer accepts a partial body — name alone is enough.
const patchErrors = bookstoreEntities.validate(PatchCustomerSchema.$id, { 'name': aboxFixtures.customer.name });

console.assert(patchErrors.length === 0);

// StrictCustomer requires every field, including addresses.
const strictErrors = bookstoreEntities.validate(StrictCustomerSchema.$id, {
  'email': aboxFixtures.customer.email,
  'id': aboxFixtures.customer.id,
  'name': aboxFixtures.customer.name
  // addresses missing — required by StrictCustomer
});

console.assert(strictErrors.length > 0);

// Full Bastian fixture passes StrictCustomer.
const strictOk = bookstoreEntities.validate(
  StrictCustomerSchema.$id,
  aboxFixtures.customer
);

console.assert(strictOk.length === 0);
