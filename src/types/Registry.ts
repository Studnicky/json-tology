import type { DuplicateSchemaIdInterface } from './TypeErrors.js';
import type { ParseOutputType } from './Transform.js';

/** Build a cross-schema references map: `{ [$id]: SchemaType }` for $ref resolution. */

export type SchemaReferencesMapType<T extends readonly unknown[]>
  = T extends readonly [infer First, ...infer Rest]
    ? First extends { readonly '$id': infer Id extends string }
      ? Record<Id, First> & SchemaReferencesMapType<Rest>
      : SchemaReferencesMapType<Rest>
    : Record<never, never>;

/** Extract `{ [$id]: ParseOutputType<T> }` from a single schema.
 *  Uses ParseOutputType so that transformed schemas map to the decoded type
 *  (matching parse() behavior), while plain schemas map to the wire shape.
 *
 *  @typeParam TReferences - Cross-schema references map for $ref resolution. */
export type SchemaEntryType<T, TReferences = Record<never, never>>
  = T extends { readonly '$id': infer Id extends string }
    ? Record<Id, ParseOutputType<T, TReferences>>
    : Record<never, never>;

/** Build a type map from a readonly tuple of schemas.
 *  Automatically threads cross-schema references so $ref between schemas resolves.
 *
 *  The `TRefs` parameter captures the references map computed from the full
 *  initial tuple and is threaded through recursion unchanged. Without this,
 *  the recursive step would recompute references from `Rest` only, so entries
 *  built later in the tuple would lose access to schemas earlier in the tuple
 *  (and vice versa, since `Rest` shrinks on each step). The result was that a
 *  `$ref` between two registered schemas resolved to `unknown` instead of the
 *  referenced schema's inferred shape. */
export type SchemaMapFromTupleType<
  T extends readonly unknown[],
  TRefs = SchemaReferencesMapType<T>
>
  = T extends readonly [infer First, ...infer Rest]
    ? SchemaEntryType<First, TRefs>
      & SchemaMapFromTupleType<Rest, TRefs>
    : Record<never, never>;

/** True when a tuple contains two or more schemas with the same `$id`. */
type HasDuplicateIdsType<T extends readonly unknown[], TSeen = never>
  = T extends readonly [infer First, ...infer Rest]
    ? First extends { readonly '$id': infer Id extends string }
      ? Id extends TSeen ? true : HasDuplicateIdsType<Rest, Id | TSeen>
      : HasDuplicateIdsType<Rest, TSeen>
    : false;

/** Collect `$id` values that appear more than once in a tuple. */
type DuplicateIdsType<T extends readonly unknown[], TSeen = never, TDupes = never>
  = T extends readonly [infer First, ...infer Rest]
    ? First extends { readonly '$id': infer Id extends string }
      ? Id extends TSeen
        ? DuplicateIdsType<Rest, TSeen, Id | TDupes>
        : DuplicateIdsType<Rest, Id | TSeen, TDupes>
      : DuplicateIdsType<Rest, TSeen, TDupes>
    : TDupes;

/** Enforces unique `$id` values across a schema tuple at compile time.
 *
 *  When two or more entries share an `$id`, the offending tuple slots are
 *  branded with `DuplicateSchemaIdInterface<TId>`. Assignment fails at
 *  compile time and the editor surfaces the duplicated IRI by name. */
export type UniqueSchemaIdsType<T extends readonly unknown[]>
  = true extends HasDuplicateIdsType<T>
    ? { [K in keyof T]: T[K] extends { readonly '$id': infer Id extends string }
      ? Id extends DuplicateIdsType<T>
        ? DuplicateSchemaIdInterface<Id> & T[K] & { readonly '$id': `DUPLICATE $id: ${Id}` }
        : T[K]
      : T[K] }
    : T;
