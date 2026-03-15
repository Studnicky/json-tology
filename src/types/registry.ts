import type { ParseOutputType } from './transform.js';

/** Extract `{ [$id]: ParseOutputType<T> }` from a single schema.
 *  Uses ParseOutputType so that transformed schemas map to the decoded type
 *  (matching parse() behavior), while plain schemas map to the wire shape. */
export type SchemaEntryType<T>
  = T extends { readonly '$id': infer Id extends string }
    ? Record<Id, ParseOutputType<T>>
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    : {};

/** Build a type map from a readonly tuple of schemas. */
export type SchemaMapFromTupleType<T extends readonly unknown[]>
  = T extends readonly [infer First, ...infer Rest]
    ? SchemaEntryType<First> & SchemaMapFromTupleType<Rest>
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    : {};
