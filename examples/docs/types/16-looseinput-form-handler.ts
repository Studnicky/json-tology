/**
 * LooseInputType — Example: Accepting unvalidated customer input.
 *
 * A form handler accepts a plain `Record<string, unknown>` so callers
 * do not need to produce pre-branded values. `instantiate` then
 * validates the raw object and returns the fully branded `Customer`.
 */

import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';
import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

type Customer = InferType<typeof CustomerSchema>;
//   { readonly id: string & FormatBrand<'uuid'>;
//     readonly email: string & FormatBrand<'email'>;
//     readonly name: string;
//     readonly addresses?: readonly Address[]; }

type CustomerInput = LooseInputType<Customer>;
// Record<string, unknown> — strips all brands for raw-input boundaries.

function createCustomerFromForm(raw: CustomerInput): Customer {
  // bookstoreEntities.instantiate validates against CustomerSchema and
  // returns a fully branded Customer value.
  return bookstoreEntities.instantiate(CustomerSchema, raw);
}

// A form payload — plain primitives, no brands required from the caller.
const formPayload: CustomerInput = {
  'email': 'bastian@neverending.example',
  'id': '09f8e7d6-c5b4-4321-9876-543210fedcba',
  'name': 'Bastian Balthazar Bux'
};

const customer = createCustomerFromForm(formPayload);

console.assert(customer.id === formPayload.id);
console.assert(customer.email === formPayload.email);
console.assert(customer.name === 'Bastian Balthazar Bux');
