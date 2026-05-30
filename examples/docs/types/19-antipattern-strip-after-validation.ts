/**
 * Anti-pattern: Stripping brands after validation.
 *
 * Once `instantiate` returns a branded `Customer`, downgrading to
 * `LooseInputType<Customer>` discards the very guarantee the
 * validation produced. Keep branded values branded — only widen at
 * input boundaries.
 */

import type {
  InferType, LooseInputType
} from '../../../src/types/index.js';
import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

type Customer = InferType<typeof CustomerSchema>;

const raw = {
  'customerId': '09f8e7d6-c5b4-4321-9876-543210fedcba',
  'email': 'bastian@neverending.example',
  'name': 'Bastian Balthazar Bux'
};

const customer: Customer = bookstoreEntities.instantiate(
  CustomerSchema,
  raw
);

// ⊥ Don't do this — you just discarded the validation guarantee.
const loose: LooseInputType<Customer> = customer;

// ✓ Do this — preserve the branded type after validation.
const stillBranded: Customer = customer;

console.assert(loose.customerId === stillBranded.customerId);
