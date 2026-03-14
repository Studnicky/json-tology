/**
 * Core type inference engine.
 *
 * Maps `as const` JSON Schema literals to TypeScript types.
 * Replaces `FromSchema` from `json-schema-to-ts`.
 *
 * ## Intentional fallbacks
 *
 * TypeScript's type system cannot express every JSON Schema constraint.
 * The following keywords use documented approximations:
 *
 * - `not` — Exclude only works on finite unions. Falls back to the base type
 *   without narrowing (the exclusion is enforced at runtime).
 * - `$dynamicRef` / `$recursiveRef` — Resolved as anchor lookup in the current
 *   root schema. Correct for same-schema usage; cross-schema falls back to
 *   `unknown`.
 * - `contains` — Inferred as `unknown[]`. Runtime validates at least one match;
 *   TypeScript cannot express "array with at least one element of type T".
 * - `propertyNames` — Falls back to `Record<string, unknown>`. Runtime enforces
 *   the pattern; TypeScript cannot constrain key shapes dynamically.
 * - `unevaluatedProperties` / `unevaluatedItems` — Treated identically to
 *   `additionalProperties` / `additionalItems`. The "unevaluated" scoping
 *   across subschemas is a runtime concern.
 * - `if/then/else` — Falls back to `unknown`. Conditional narrowing requires
 *   runtime evaluation; TypeScript cannot branch on data-dependent predicates.
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

type InferPrimitiveType<T>
  = T extends { readonly 'type': 'string' } ? string
    : T extends { readonly 'type': 'number' } ? number
      : T extends { readonly 'type': 'integer' } ? number
        : T extends { readonly 'type': 'boolean' } ? boolean
          : T extends { readonly 'type': 'null' } ? null
            : never;

// ---------------------------------------------------------------------------
// Const / Enum
// ---------------------------------------------------------------------------

type InferConstType<T>
  = T extends { readonly 'const': infer V } ? V : never;

type InferEnumType<T>
  = T extends { readonly 'enum': ReadonlyArray<infer V> } ? V : never;

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

type InferArrayType<T, Root>
  = T extends { readonly 'items': infer I;
    readonly 'type': 'array'; }
    ? ReadonlyArray<InferSchemaType<I, Root>>
    : T extends { readonly 'prefixItems': readonly [...infer P];
      readonly 'type': 'array'; }
      ? { readonly [K in keyof P]: InferSchemaType<P[K], Root> }
      : T extends { readonly 'type': 'array' }
        ? readonly unknown[]
        : never;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

type ExtractRequiredKeysType<T>
  = T extends { readonly 'required': ReadonlyArray<infer K extends string> } ? K : never;

type InferObjectTypePropsType<P, R extends string, Root> = SimplifyType<
  { readonly [K in keyof P & string as K extends R ? K : never]: InferSchemaType<P[K], Root> }
  & { readonly [K in keyof P & string as K extends R ? never : K]?: InferSchemaType<P[K], Root> }
>;

type InferAdditionalType<T, Root>
  = T extends { readonly 'additionalProperties': false } ? unknown
    : T extends { readonly 'additionalProperties': infer A } ? { readonly [key: string]: InferSchemaType<A, Root> }
      : unknown;

type InferObjectType<T, Root>
  = T extends { readonly 'properties': infer P;
    readonly 'type': 'object'; }
    ? InferAdditionalType<T, Root> & InferObjectTypePropsType<P, ExtractRequiredKeysType<T>, Root>
    : T extends { readonly 'type': 'object' }
      ? Record<string, unknown>
      : never;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

type InferAllOfType<T, Root>
  = T extends { readonly 'allOf': readonly [infer A, ...infer Rest] }
    ? InferAllOfType<{ readonly 'allOf': Rest }, Root> & InferSchemaType<A, Root>
    : unknown;

type InferAnyOfType<T, Root>
  = T extends { readonly 'anyOf': ReadonlyArray<infer V> }
    ? InferSchemaType<V, Root>
    : never;

type InferOneOfType<T, Root>
  = T extends { readonly 'oneOf': ReadonlyArray<infer V> }
    ? InferSchemaType<V, Root>
    : never;

// ---------------------------------------------------------------------------
// $anchor resolution
// ---------------------------------------------------------------------------

/**
 * Find a schema definition by $anchor name within a root schema.
 *
 * Searches root-level `$anchor` and all entries in `$defs` for a matching
 * `$anchor` value.
 */
type FindAnchorType<Anchor extends string, Root>
  // Check root-level $anchor
  = Root extends { readonly '$anchor': Anchor }
    ? Root
    // Search through $defs for matching $anchor
    : Root extends { readonly '$defs': infer D }
      ? FindAnchorInDefsType<Anchor, D>
      : unknown;

/** Search $defs entries for a matching $anchor. */
type FindAnchorInDefsType<Anchor extends string, D>
  = D extends Record<string, unknown>
    ? { [K in keyof D]: D[K] extends { readonly '$anchor': Anchor } ? D[K] : never }[keyof D]
    : unknown;

// ---------------------------------------------------------------------------
// External fragment ref helpers
// ---------------------------------------------------------------------------

/**
 * Split a ref with a fragment into base URI and fragment parts.
 * Handles `schema#anchor` and `schema#/json/pointer` patterns.
 *
 * For cross-schema refs (base URI differs from Root.$id), falls back to
 * `unknown` because compile-time resolution requires a schema registry
 * (which is a runtime concept).
 */
type SplitFragmentRefType<Ref extends string, Root>
  = Ref extends `${infer Base}#${infer Fragment}`
    ? Root extends { readonly '$id': infer Id }
      ? Base extends Id
        ? Fragment extends `/$defs/${infer K}`
          ? Root extends { readonly '$defs': infer D }
            ? K extends keyof D
              ? D[K]
              : unknown
            : unknown
          : Fragment extends `/${infer Path}`
            ? NavigateSchemaPathType<Root, Path>
            : FindAnchorType<Fragment, Root>
        : unknown
      : unknown
    : unknown;

/**
 * Navigate a JSON Pointer path segment within a schema.
 * Supports multi-level paths like `properties/name/type`.
 */
type NavigateSchemaPathType<T, Path extends string>
  = Path extends `${infer Head}/${infer Rest}`
    ? Head extends keyof T
      ? NavigateSchemaPathType<T[Head], Rest>
      : unknown
    : Path extends keyof T
      ? T[Path]
      : unknown;

// ---------------------------------------------------------------------------
// $ref / $defs / $anchor / $dynamicRef / $recursiveRef resolution
// ---------------------------------------------------------------------------

type InferRefType<T, Root>
  // Local $defs ref: #/$defs/Foo (simple key only, no further path segments)
  = T extends { readonly '$ref': `#/$defs/${infer K}` }
    ? K extends `${string}/${string}`
      // Complex path through $defs — use JSON Pointer navigation
      ? InferSchemaType<NavigateSchemaPathType<Root, `$defs/${K}`>, Root>
      : Root extends { readonly '$defs': infer D }
        ? K extends keyof D
          ? InferSchemaType<D[K], Root>
          : unknown
        : unknown
    // Self ref: #
    : T extends { readonly '$ref': '#' }
      ? InferSchemaType<Root, Root>
      // Anchor ref: #anchorName (no slash after #)
      : T extends { readonly '$ref': `#${infer Anchor}` }
        ? Anchor extends `/${string}`
          // JSON Pointer path: #/properties/foo — navigate the path
          ? InferSchemaType<NavigateSchemaPathType<Root, RemoveLeadingSlashType<Anchor>>, Root>
          // Named anchor: #myAnchor
          : InferSchemaType<FindAnchorType<Anchor, Root>, Root>
        // External ref with fragment: someUri#fragment — cannot resolve cross-schema at compile time
        : T extends { readonly '$ref': `${string}#${string}` }
          ? unknown
          // Absolute/external ref without fragment — cannot resolve at compile time
          : unknown;

/** Strip the leading `/` from a JSON Pointer path segment. */
type RemoveLeadingSlashType<S extends string>
  = S extends `/${infer Rest}` ? Rest : S;

// ---------------------------------------------------------------------------
// $dynamicRef / $recursiveRef approximation
// ---------------------------------------------------------------------------

/**
 * $dynamicRef and $recursiveRef are approximated as anchor lookups in the
 * current root schema. This is correct when the ref target is defined in the
 * same schema. Cross-schema dynamic resolution falls back to `unknown`.
 *
 * At runtime, $dynamicRef resolves against the dynamic scope (the outermost
 * schema that declares a matching $dynamicAnchor). TypeScript cannot model
 * dynamic scope, so we approximate with static root-level lookup.
 */
type InferDynamicRefType<T, Root>
  = T extends { readonly '$dynamicRef': `#${infer Anchor}` }
    ? InferSchemaType<FindAnchorType<Anchor, Root>, Root>
    : unknown;

/**
 * $recursiveRef (draft 2019-09) always points to `#`. When $recursiveAnchor
 * is true on the root, the ref resolves to the root schema itself. This is
 * the same behavior as $dynamicRef with $dynamicAnchor.
 */
type InferRecursiveRefType<T, Root>
  = T extends { readonly '$recursiveRef': '#' }
    ? Root extends { readonly '$recursiveAnchor': true }
      ? InferSchemaType<Root, Root>
      : unknown
    : unknown;

// ---------------------------------------------------------------------------
// Nullable (type arrays)
// ---------------------------------------------------------------------------

type InferSingleTypeType<U extends string, T, Root>
  = U extends 'string' ? string
    : U extends 'number' ? number
      : U extends 'integer' ? number
        : U extends 'boolean' ? boolean
          : U extends 'null' ? null
            : U extends 'array' ? InferArrayType<T, Root>
              : U extends 'object' ? InferObjectType<T, Root>
                : never;

type InferTypeArrayType<T, Root>
  = T extends { readonly 'type': ReadonlyArray<infer U extends string> }
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
export type InferSchemaType<T, Root = T>
  // Bail out for boolean schemas and broad types
  = [T] extends [boolean] ? unknown
  // Phase 1: Transform/Brand phantom types (peel off first)
    : T extends TransformBrandInterface<infer Out> ? Out
    // Phase 2: Const/Enum literals
      : T extends { readonly 'const': unknown } ? InferConstType<T>
        : T extends { readonly 'enum': readonly unknown[] } ? InferEnumType<T>
        // Phase 3: $ref / $dynamicRef / $recursiveRef
          : T extends { readonly '$ref': string } ? InferRefType<T, Root>
            : T extends { readonly '$dynamicRef': string } ? InferDynamicRefType<T, Root>
              : T extends { readonly '$recursiveRef': string } ? InferRecursiveRefType<T, Root>
              // Phase 4: Composition
                : T extends { readonly 'allOf': readonly unknown[] } ? InferAllOfType<T, Root>
                  : T extends { readonly 'anyOf': readonly unknown[] } ? InferAnyOfType<T, Root>
                    : T extends { readonly 'oneOf': readonly unknown[] } ? InferOneOfType<T, Root>
                    // Phase 5: Type-based
                      : T extends { readonly 'type': readonly unknown[] } ? InferTypeArrayType<T, Root>
                        : T extends { readonly 'type': 'array' } ? InferArrayType<T, Root>
                          : T extends { readonly 'type': 'object' } ? InferObjectType<T, Root>
                            : InferPrimitiveType<T> extends never ? unknown : InferPrimitiveType<T>;

// ---------------------------------------------------------------------------
// Public helper types (re-exported via schema.ts)
// ---------------------------------------------------------------------------

export type {
  FindAnchorType, NavigateSchemaPathType, SplitFragmentRefType
};
