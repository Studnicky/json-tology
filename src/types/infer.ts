/**
 * Core type inference engine.
 *
 * Maps `as const` JSON Schema literals to TypeScript types.
 * Replaces `FromSchema` from `json-schema-to-ts`.
 */

import type { TransformBrand } from './transform.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten an intersection into a single object type. */
type Simplify<T> = { [K in keyof T]: T[K] } & {};

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type InferPrimitive<T> =
  T extends { readonly type: 'string' } ? string :
  T extends { readonly type: 'number' } ? number :
  T extends { readonly type: 'integer' } ? number :
  T extends { readonly type: 'boolean' } ? boolean :
  T extends { readonly type: 'null' } ? null :
  never;

// ---------------------------------------------------------------------------
// Const / Enum
// ---------------------------------------------------------------------------

type InferConst<T> =
  T extends { readonly const: infer V } ? V : never;

type InferEnum<T> =
  T extends { readonly enum: readonly (infer V)[] } ? V : never;

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

type InferArray<T, Root> =
  T extends { readonly type: 'array'; readonly items: infer I }
    ? readonly InferSchema<I, Root>[]
    : T extends { readonly type: 'array'; readonly prefixItems: readonly [...infer P] }
      ? { readonly [K in keyof P]: InferSchema<P[K], Root> }
      : T extends { readonly type: 'array' }
        ? readonly unknown[]
        : never;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

type ExtractRequiredKeys<T> =
  T extends { readonly required: readonly (infer K extends string)[] } ? K : never;

type InferObjectProps<P, R extends string, Root> = Simplify<
  { readonly [K in keyof P & string as K extends R ? K : never]: InferSchema<P[K], Root> } &
  { readonly [K in keyof P & string as K extends R ? never : K]?: InferSchema<P[K], Root> }
>;

type InferAdditional<T, Root> =
  T extends { readonly additionalProperties: false } ? unknown :
  T extends { readonly additionalProperties: infer A } ? { readonly [key: string]: InferSchema<A, Root> } :
  unknown;

type InferObject<T, Root> =
  T extends { readonly type: 'object'; readonly properties: infer P }
    ? InferObjectProps<P, ExtractRequiredKeys<T>, Root> & InferAdditional<T, Root>
    : T extends { readonly type: 'object' }
      ? Record<string, unknown>
      : never;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

type InferAllOf<T, Root> =
  T extends { readonly allOf: readonly [infer A, ...infer Rest] }
    ? InferSchema<A, Root> & InferAllOf<{ readonly allOf: Rest }, Root>
    : unknown;

type InferAnyOf<T, Root> =
  T extends { readonly anyOf: readonly (infer V)[] }
    ? InferSchema<V, Root>
    : never;

type InferOneOf<T, Root> =
  T extends { readonly oneOf: readonly (infer V)[] }
    ? InferSchema<V, Root>
    : never;

// ---------------------------------------------------------------------------
// $ref / $defs resolution
// ---------------------------------------------------------------------------

type InferRef<T, Root> =
  T extends { readonly $ref: `#/$defs/${infer K}` }
    ? Root extends { readonly $defs: infer D }
      ? K extends keyof D
        ? InferSchema<D[K], Root>
        : unknown
      : unknown
    : T extends { readonly $ref: '#' }
      ? InferSchema<Root, Root>
      : unknown;

// ---------------------------------------------------------------------------
// Nullable (type arrays)
// ---------------------------------------------------------------------------

type InferSingleType<U extends string, T, Root> =
  U extends 'string' ? string :
  U extends 'number' ? number :
  U extends 'integer' ? number :
  U extends 'boolean' ? boolean :
  U extends 'null' ? null :
  U extends 'array' ? InferArray<T, Root> :
  U extends 'object' ? InferObject<T, Root> :
  never;

type InferTypeArray<T, Root> =
  T extends { readonly type: readonly (infer U extends string)[] }
    ? InferSingleType<U, T, Root>
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
export type InferSchema<T, Root = T> =
  // Bail out for boolean schemas and broad types
  [T] extends [boolean] ? unknown :
  // Phase 1: Transform/Brand phantom types (peel off first)
  T extends TransformBrand<infer Out> ? Out :
  // Phase 2: Const/Enum literals
  T extends { readonly const: unknown } ? InferConst<T> :
  T extends { readonly enum: readonly unknown[] } ? InferEnum<T> :
  // Phase 3: $ref
  T extends { readonly $ref: string } ? InferRef<T, Root> :
  // Phase 4: Composition
  T extends { readonly allOf: readonly unknown[] } ? InferAllOf<T, Root> :
  T extends { readonly anyOf: readonly unknown[] } ? InferAnyOf<T, Root> :
  T extends { readonly oneOf: readonly unknown[] } ? InferOneOf<T, Root> :
  // Phase 5: Type-based
  T extends { readonly type: readonly unknown[] } ? InferTypeArray<T, Root> :
  T extends { readonly type: 'array' } ? InferArray<T, Root> :
  T extends { readonly type: 'object' } ? InferObject<T, Root> :
  InferPrimitive<T> extends never ? unknown : InferPrimitive<T>;
