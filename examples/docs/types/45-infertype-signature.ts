/**
 * InferType — Signature
 *
 * `InferType<TSchema, TReferences = {}>` is the primary inference
 * utility: derive a TypeScript type from an `as const` JSON Schema
 * literal. Internally it threads `TSchema` through brand application
 * and restriction layers, ultimately delegating element-level
 * inference to `InferSchemaType<TSchema, TSchema, TReferences>`.
 */

import type { InferType } from '../../../src/types/index.js';
import type { BookSchema } from '../bookstore/index.js';

// Derive the TypeScript type of a registered schema literal:
type Book = InferType<typeof BookSchema>;

// Customary surface — same call shape across every consumer of the
// bookstore registry:
//   type Customer = InferType<typeof CustomerSchema>;
//   type Order    = InferType<typeof OrderSchema>;

const sampleIsbn = '9783522202008';

// At runtime we just hold a placeholder; the value of this example is
// in the type derivation above.
void (null as unknown as Book);
console.assert(sampleIsbn.length === 13);
