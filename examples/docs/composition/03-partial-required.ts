/**
 * Compose.partial / required — Example 1: PATCH and strict-create schemas
 * Demonstrates: partial removes required, required makes all fields required
 */

import {
  Compose, JsonTology
} from '../../../src/index.js';
import { CustomerSchema } from '../bookstore/schemas.js';

// partial — PATCH body (all fields optional)
const PatchCustomerSchema = Compose.partial(
  CustomerSchema,
  'https://bookstore.example/PatchCustomer'
);

// required — strict create body (all fields required)
const StrictCustomerSchema = Compose.required(
  CustomerSchema,
  'https://bookstore.example/StrictCustomer'
);


const bookstoreJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [
    PatchCustomerSchema,
    StrictCustomerSchema
  ] as const
});

// PatchCustomer accepts empty (all optional)
const patchErrors = bookstoreJt.validate(PatchCustomerSchema.$id, { 'name': 'Alice P. Chen' });

console.assert(patchErrors.length === 0);

// StrictCustomer requires addresses too
const strictErrors = bookstoreJt.validate(StrictCustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
  // addresses missing — required by StrictCustomer
});

console.assert(strictErrors.length > 0);
