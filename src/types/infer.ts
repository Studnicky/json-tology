/**
 * Core type inference engine.
 *
 * Maps `as const` JSON Schema literals to TypeScript types.
 * Replaces `FromSchema` from `json-schema-to-ts`.
 */

import type { TransformBrandInterface } from './transform.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten an intersection into a single object type. */
type SimplifyType<T> = { [K in keyof T]: T[K] } & {};

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type InferPrimitiveType<T> =
  T extends { readonly type: 'string' } ? string :
  T extends { readonly type: 'number' } ? number :
  T extends { readonly type: 'integer' } ? number :
  T extends { readonly type: 'boolean' } ? boolean :
  T extends { readonly type: 'null' } ? null :
  never;

// ---------------------------------------------------------------------------
// Const / Enum
// ---------------------------------------------------------------------------

type InferConstType<T> =
  T extends { readonly const: infer V } ? V : never;

type InferEnumType<T> =
  T extends { readonly enum: readonly (infer V)[] } ? V : never;

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

type InferArrayType<T, Root> =
  T extends { readonly type: 'array'; readonly items: infer I }
    ? readonly InferSchemaType<I, Root>[]
    : T extends { readonly type: 'array'; readonly prefixItems: readonly [...infer P] }
      ? { readonly [K in keyof P]: InferSchemaType<P[K], Root> }
      : T extends { readonly type: 'array' }
        ? readonly unknown[]
        : never;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

type ExtractRequiredKeysType<T> =
  T extends { readonly required: readonly (infer K extends string)[] } ? K : never;

type InferObjectTypePropsType<P, R extends string, Root> = SimplifyType<
  { readonly [K in keyof P & string as K extends R ? K : never]: InferSchemaType<P[K], Root> } &
  { readonly [K in keyof P & string as K extends R ? never : K]?: InferSchemaType<P[K], Root> }
>;

type InferAdditionalType<T, Root> =
  T extends { readonly additionalProperties: false } ? unknown :
  T extends { readonly additionalProperties: infer A } ? { readonly [key: string]: InferSchemaType<A, Root> } :
  unknown;

type InferObjectType<T, Root> =
  T extends { readonly type: 'object'; readonly properties: infer P }
    ? InferObjectTypePropsType<P, ExtractRequiredKeysType<T>, Root> & InferAdditionalType<T, Root>
    : T extends { readonly type: 'object' }
      ? Record<string, unknown>
      : never;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

type InferAllOfType<T, Root> =
  T extends { readonly allOf: readonly [infer A, ...infer Rest] }
    ? InferSchemaType<A, Root> & InferAllOfType<{ readonly allOf: Rest }, Root>
    : unknown;

type InferAnyOfType<T, Root> =
  T extends { readonly anyOf: readonly (infer V)[] }
    ? InferSchemaType<V, Root>
    : never;

type InferOneOfType<T, Root> =
  T extends { readonly oneOf: readonly (infer V)[] }
    ? InferSchemaType<V, Root>
    : never;

// ---------------------------------------------------------------------------
// $ref / $defs resolution
// ---------------------------------------------------------------------------

type InferRefType<T, Root> =
  T extends { readonly $ref: `#/$defs/${infer K}` }
    ? Root extends { readonly $defs: infer D }
      ? K extends keyof D
        ? InferSchemaType<D[K], Root>
        : unknown
      : unknown
    : T extends { readonly $ref: '#' }
      ? InferSchemaType<Root, Root>
      : unknown;

// ---------------------------------------------------------------------------
// Nullable (type arrays)
// ---------------------------------------------------------------------------

type InferSingleTypeType<U extends string, T, Root> =
  U extends 'string' ? string :
  U extends 'number' ? number :
  U extends 'integer' ? number :
  U extends 'boolean' ? boolean :
  U extends 'null' ? null :
  U extends 'array' ? InferArrayType<T, Root> :
  U extends 'object' ? InferObjectType<T, Root> :
  never;

type InferTypeArrayType<T, Root> =
  T extends { readonly type: readonly (infer U extends string)[] }
    ? InferSingleTypeType<U, T, Root>
    : never;

// ---------------------------------------------------------------------------
// Master dispatcher
// ---------------------------------------------------------------------------

/**
 * Infer a TypeScript type from a JSON Schema literal type.
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam Root - The root schema for $ref resolution (defaults to T).
 */
export type InferSchemaType<T, Root = T> =
  // Bail out for boolean schemas and broad types
  [T] extends [boolean] ? unknown :
  // Phase 1: Transform/Brand phantom types (peel off first)
  T extends TransformBrandInterface<infer Out> ? Out :
  // Phase 2: Const/Enum literals
  T extends { readonly const: unknown } ? InferConstType<T> :
  T extends { readonly enum: readonly unknown[] } ? InferEnumType<T> :
  // Phase 3: $ref
  T extends { readonly $ref: string } ? InferRefType<T, Root> :
  // Phase 4: Composition
  T extends { readonly allOf: readonly unknown[] } ? InferAllOfType<T, Root> :
  T extends { readonly anyOf: readonly unknown[] } ? InferAnyOfType<T, Root> :
  T extends { readonly oneOf: readonly unknown[] } ? InferOneOfType<T, Root> :
  // Phase 5: Type-based
  T extends { readonly type: readonly unknown[] } ? InferTypeArrayType<T, Root> :
  T extends { readonly type: 'array' } ? InferArrayType<T, Root> :
  T extends { readonly type: 'object' } ? InferObjectType<T, Root> :
  InferPrimitiveType<T> extends never ? unknown : InferPrimitiveType<T>;
