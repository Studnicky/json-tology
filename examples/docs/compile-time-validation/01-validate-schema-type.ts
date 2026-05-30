/**
 * Compile-time schema validation: ValidateSchemaType opt-in
 *
 * `ValidateSchemaType<T>` resolves to `T` when the schema is internally
 * consistent and to `never` when a cross-keyword violation is detected.
 * Assign the schema to a `ValidateSchemaType`-typed variable to opt in
 * for hand-written schemas.
 *
 * Schemas passed to `Compose.subClassOf`, `Compose.complementOf`,
 * `Compose.disjointWith`, and `Compose.extend` are validated automatically
 * — no manual `_check` variable needed.
 */

import type { ValidateSchemaType } from '../../../src/types/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

// ReviewSchema is internally consistent — all required keys are in properties.
// This assignment compiles cleanly.
const _check: ValidateSchemaType<typeof ReviewSchema> = ReviewSchema;

void _check;

// Runtime confirmation: valid review validates without errors.
import { aboxFixtures } from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, aboxFixtures.review);

console.assert(errs.length === 0);

// Log: ValidateSchemaType accepted ReviewSchema (all required keys present in properties).
console.log('ValidateSchemaType<ReviewSchema> accepted — compile-time check passed');
console.log(`runtime validation errors: ${errs.length} (expected 0)`);
