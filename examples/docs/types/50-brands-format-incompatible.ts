/**
 * Constraint brands — Example: Format brands prevent mixing email and
 * UUID strings.
 *
 * Two `string` schemas with different `format` keywords resolve to
 * structurally incompatible TypeScript types — their `FormatBrand`
 * intersections differ. The only way to obtain a branded value is via
 * `instantiate`, which validates the format and applies the brand.
 */

import type { InferType } from '../../../src/types/index.js';
import {
  bookstoreEntities, CustomerIdSchema, EmailSchema
} from '../bookstore/index.js';

type CustomerId = InferType<typeof CustomerIdSchema>;
// string & FormatBrand<'uuid'>

type Email = InferType<typeof EmailSchema>;
// string & FormatBrand<'email'>

// TypeScript rejects mixing the two brands at compile time. Use
// `instantiate` to validate and brand a value:
const id: CustomerId = bookstoreEntities.instantiate(
  CustomerIdSchema,
  '09f8e7d6-c5b4-4321-9876-543210fedcba'
);
const email: Email = bookstoreEntities.instantiate(
  EmailSchema,
  'bastian@neverending.example'
);

// Both are strings at runtime …
console.assert(typeof id === 'string');
console.assert(typeof email === 'string');

// … but the brands keep them structurally distinct in the type system.
// const swap: CustomerId = email; // compile error — brand mismatch
