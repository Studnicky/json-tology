/**
 * Compose.partial / required — Example 1: PATCH and strict-create schemas
 * Demonstrates: partial removes required, required makes all fields required
 *
 * Derived schemas register onto the canonical bookstore via
 * `jt.set()`. Inputs use the Bastian Balthazar Bux fixture
 * shared with every other doc example.
 */

import { Compose } from '../../../src/index.js';
import {
  aboxFixtures, createBookstoreDocRegistry,
  CustomerSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer'
);

const StrictCustomerSchema = Compose.required(
  CustomerSchema,
  'https://bookstore.example/StrictCustomer'
);

const jt2 = jt.set(PatchCustomerSchema).set(StrictCustomerSchema);

// PatchCustomer accepts a partial body — name alone is enough.
const patchErrors = jt2.validate(PatchCustomerSchema.$id, { 'name': aboxFixtures.customer.name });

console.assert(patchErrors.length === 0);

// StrictCustomer requires every field, including addresses.
const strictErrors = jt2.validate(StrictCustomerSchema.$id, {
  'customerId': aboxFixtures.customer.customerId,
  'email': aboxFixtures.customer.email,
  'name': aboxFixtures.customer.name
  // addresses missing — required by StrictCustomer
});

console.assert(strictErrors.length > 0);

// Full Bastian fixture passes StrictCustomer.
const strictOk = jt2.validate(
  StrictCustomerSchema.$id,
  aboxFixtures.customer
);

console.assert(strictOk.length === 0);
