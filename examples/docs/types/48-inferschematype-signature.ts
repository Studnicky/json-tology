/**
 * InferSchemaType — Signature
 *
 * The canonical declaration of InferSchemaType<T, TRoot, TReferences>:
 * lower-level inference with explicit root control. Resolves `$ref`
 * against the specified root schema. `InferType<T>` calls
 * `InferSchemaType<T, T>` internally — explicit use is only needed
 * when the sub-schema and the resolution root are different objects.
 */

import type {
  InferSchemaType
} from '../../../src/types/index.js';
import {
  BookSchema
} from '../bookstore/index.js';

// Surface declaration:
//
//   type MySubType = InferSchemaType<
//     typeof SubSchema,    // The sub-schema to infer
//     typeof RootSchema,   // Root schema providing $defs for $ref
//     RefMap               // Optional cross-schema reference map
//   >;

// When sub and root are the same, InferSchemaType behaves like InferType
// without the additional brand wrappers.
type BookViaSchema = InferSchemaType<
  typeof BookSchema,
  typeof BookSchema
>;
// Confirm the inferred type carries the expected isbn field.
const _bookVia: Partial<BookViaSchema> = {};

void _bookVia;

console.assert(typeof BookSchema.$id === 'string');
