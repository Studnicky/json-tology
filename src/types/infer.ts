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
 *   `unknown` unless the consumer provides an explicit references map.
 * - `contains` — Inferred as `unknown[]`. Runtime validates at least one match;
 *   TypeScript cannot express "array with at least one element of type T".
 * - `propertyNames` — Falls back to `Record<string, unknown>`. Runtime enforces
 *   the pattern; TypeScript cannot constrain key shapes dynamically.
 * - `unevaluatedProperties` / `unevaluatedItems` — Treated identically to
 *   `additionalProperties` / `additionalItems`. The "unevaluated" scoping
 *   across subschemas is a runtime concern.
 * - `if/then/else` — Uses a sound over-approximation: union the possible branch
 *   outputs merged with the non-conditional base schema.
 */

import type { TransformBrandInterface } from '../interfaces/transform-brand.js';

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

type InferArrayType<T, TRoot, TReferences>
  = T extends { readonly 'items': infer I;
    readonly 'type': 'array'; }
    ? ReadonlyArray<InferSchemaType<I, TRoot, TReferences>>
    : T extends { readonly 'prefixItems': readonly [...infer TPrefix];
      readonly 'type': 'array'; }
      ? { readonly [K in keyof TPrefix]: InferSchemaType<TPrefix[K], TRoot, TReferences> }
      : T extends { readonly 'type': 'array' }
        ? readonly unknown[]
        : never;

// ---------------------------------------------------------------------------
// Objects
// ---------------------------------------------------------------------------

type ExtractRequiredKeysType<T>
  = T extends { readonly 'required': ReadonlyArray<infer K extends string> } ? K : never;

type InferObjectTypePropsType<TProps, TRequired extends string, TRoot, TReferences> = SimplifyType<
  { readonly [K in keyof TProps & string as K extends TRequired ? K : never]:
    InferSchemaType<TProps[K], TRoot, TReferences> }
  & { readonly [K in keyof TProps & string as K extends TRequired ? never : K]?:
    InferSchemaType<TProps[K], TRoot, TReferences> }
>;

type InferAdditionalType<T, TRoot, TReferences>
  = T extends { readonly 'additionalProperties': false } ? unknown
    : T extends { readonly 'additionalProperties': infer A }
      ? { readonly [key: string]: InferSchemaType<A, TRoot, TReferences> }
      : unknown;

type InferObjectType<T, TRoot, TReferences>
  = T extends { readonly 'properties': infer TProps;
    readonly 'type': 'object'; }
    ? InferAdditionalType<T, TRoot, TReferences>
      & InferObjectTypePropsType<TProps, ExtractRequiredKeysType<T>, TRoot, TReferences>
    : T extends { readonly 'type': 'object' }
      ? Record<string, unknown>
      : never;

// ---------------------------------------------------------------------------
// Composition
// ---------------------------------------------------------------------------

type InferAllOfType<T, TRoot, TReferences>
  = T extends { readonly 'allOf': readonly [infer A, ...infer Rest] }
    ? InferAllOfType<{ readonly 'allOf': Rest }, TRoot, TReferences> & InferSchemaType<A, TRoot, TReferences>
    : unknown;

type InferAnyOfType<T, TRoot, TReferences>
  = T extends { readonly 'anyOf': ReadonlyArray<infer V> }
    ? InferSchemaType<V, TRoot, TReferences>
    : never;

type InferOneOfType<T, TRoot, TReferences>
  = T extends { readonly 'oneOf': ReadonlyArray<infer V> }
    ? InferSchemaType<V, TRoot, TReferences>
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
type FindAnchorType<TAnchor extends string, TRoot>
  // Check root-level $anchor
  = TRoot extends { readonly '$anchor': TAnchor }
    ? TRoot
    // Search through $defs for matching $anchor
    : TRoot extends { readonly '$defs': infer TDefs }
      ? FindAnchorInDefsType<TAnchor, TDefs>
      : unknown;

/** Search $defs entries for a matching $anchor. */
type FindAnchorInDefsType<TAnchor extends string, TDefs>
  = TDefs extends Record<string, unknown>
    ? { [K in keyof TDefs]: TDefs[K] extends { readonly '$anchor': TAnchor } ? TDefs[K] : never }[keyof TDefs]
    : unknown;

type ResolveRefBaseSchemaType<TBase extends string, TRoot, TReferences>
  = TRoot extends { readonly '$id': infer TId extends string }
    ? TBase extends TId
      ? TRoot
      : TBase extends keyof TReferences
        ? TReferences[TBase]
        : unknown
    : TBase extends keyof TReferences
      ? TReferences[TBase]
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
type SplitFragmentRefType<TRef extends string, TRoot, TReferences = {}>
  = TRef extends `${infer Base}#${infer Fragment}`
    ? ResolveRefBaseSchemaType<Base, TRoot, TReferences> extends infer TBaseSchema
      ? Fragment extends `/$defs/${infer K}`
        ? TBaseSchema extends { readonly '$defs': infer TDefs }
          ? K extends keyof TDefs
            ? TDefs[K]
            : unknown
          : unknown
        : Fragment extends `/${infer TPath}`
          ? NavigateSchemaPathType<TBaseSchema, TPath>
          : FindAnchorType<Fragment, TBaseSchema>
      : unknown
    : unknown;

/**
 * Navigate a JSON Pointer path segment within a schema.
 * Supports multi-level paths like `properties/name/type`.
 */
type NavigateSchemaPathType<T, TPath extends string>
  = TPath extends `${infer Head}/${infer Rest}`
    ? Head extends keyof T
      ? NavigateSchemaPathType<T[Head], Rest>
      : unknown
    : TPath extends keyof T
      ? T[TPath]
      : unknown;

// ---------------------------------------------------------------------------
// $ref / $defs / $anchor / $dynamicRef / $recursiveRef resolution
// ---------------------------------------------------------------------------

type InferRefType<T, TRoot, TReferences>
  // Local $defs ref: #/$defs/Foo (simple key only, no further path segments)
  = T extends { readonly '$ref': `#/$defs/${infer K}` }
    ? K extends `${string}/${string}`
      // Complex path through $defs — use JSON Pointer navigation
      ? InferSchemaType<NavigateSchemaPathType<TRoot, `$defs/${K}`>, TRoot, TReferences>
      : TRoot extends { readonly '$defs': infer TDefs }
        ? K extends keyof TDefs
          ? InferSchemaType<TDefs[K], TRoot, TReferences>
          : unknown
        : unknown
    // Self ref: #
    : T extends { readonly '$ref': '#' }
      ? InferSchemaType<TRoot, TRoot, TReferences>
      // Anchor ref: #anchorName (no slash after #)
      : T extends { readonly '$ref': `#${infer TAnchor}` }
        ? TAnchor extends `/${string}`
          // JSON Pointer path: #/properties/foo — navigate the path
          ? InferSchemaType<NavigateSchemaPathType<TRoot, RemoveLeadingSlashType<TAnchor>>, TRoot, TReferences>
          // Named anchor: #myAnchor
          : InferSchemaType<FindAnchorType<TAnchor, TRoot>, TRoot, TReferences>
        // External ref with fragment: someUri#fragment
        : T extends { readonly '$ref': `${infer TBase}#${string}` }
          ? ResolveRefBaseSchemaType<TBase, TRoot, TReferences> extends infer TBaseSchema
            ? InferSchemaType<SplitFragmentRefType<T['$ref'], TRoot, TReferences>, TBaseSchema, TReferences>
            : unknown
          // Absolute/external ref without fragment
          : T extends { readonly '$ref': infer TRef extends string }
            ? TRef extends keyof TReferences
              ? InferSchemaType<TReferences[TRef], TReferences[TRef], TReferences>
              : unknown
            : unknown;

/** Strip the leading `/` from a JSON Pointer path segment. */
type RemoveLeadingSlashType<TStr extends string>
  = TStr extends `/${infer Rest}` ? Rest : TStr;

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
type InferDynamicRefType<T, TRoot, TReferences>
  = T extends { readonly '$dynamicRef': `#${infer TAnchor}` }
    ? InferSchemaType<FindAnchorType<TAnchor, TRoot>, TRoot, TReferences>
    : unknown;

/**
 * $recursiveRef (draft 2019-09) always points to `#`. When $recursiveAnchor
 * is true on the root, the ref resolves to the root schema itself. This is
 * the same behavior as $dynamicRef with $dynamicAnchor.
 */
type InferRecursiveRefType<T, TRoot, TReferences>
  = T extends { readonly '$recursiveRef': '#' }
    ? TRoot extends { readonly '$recursiveAnchor': true }
      ? InferSchemaType<TRoot, TRoot, TReferences>
      : unknown
    : unknown;

// ---------------------------------------------------------------------------
// Nullable (type arrays)
// ---------------------------------------------------------------------------

type InferSingleTypeType<U extends string, T, TRoot, TReferences>
  = U extends 'string' ? string
    : U extends 'number' ? number
      : U extends 'integer' ? number
        : U extends 'boolean' ? boolean
          : U extends 'null' ? null
            : U extends 'array' ? InferArrayType<T, TRoot, TReferences>
              : U extends 'object' ? InferObjectType<T, TRoot, TReferences>
                : never;

type InferTypeArrayType<T, TRoot, TReferences>
  = T extends { readonly 'type': ReadonlyArray<infer U extends string> }
    ? InferSingleTypeType<U, T, TRoot, TReferences>
    : never;

type WithoutConditionalType<T>
  = T extends object ? Omit<T, 'else' | 'if' | 'then'> : T;

type InferConditionalType<T, TRoot, TReferences>
  = T extends { readonly 'if': unknown }
    ? T extends { readonly 'else': infer TElse;
      readonly 'then': infer TThen; }
      ? InferSchemaType<TElse & WithoutConditionalType<T>, TRoot, TReferences>
        | InferSchemaType<TThen & WithoutConditionalType<T>, TRoot, TReferences>
      : T extends { readonly 'then': infer TThen }
        ? InferSchemaType<TThen & WithoutConditionalType<T>, TRoot, TReferences>
          | InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
        : T extends { readonly 'else': infer TElse }
          ? InferSchemaType<TElse & WithoutConditionalType<T>, TRoot, TReferences>
            | InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
          : InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
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
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type InferSchemaType<T, TRoot = T, TReferences = {}>
  // Bail out for boolean schemas and broad types
  = [T] extends [boolean] ? unknown
  // Phase 1: Transform brands do not change the wire-form schema type.
    : T extends TransformBrandInterface<unknown>
      ? InferSchemaType<Omit<T, keyof TransformBrandInterface<unknown>>, TRoot, TReferences>
    // Phase 2: Const/Enum literals
      : T extends { readonly 'const': unknown } ? InferConstType<T>
        : T extends { readonly 'enum': readonly unknown[] } ? InferEnumType<T>
        // Phase 3: $ref / $dynamicRef / $recursiveRef
          : T extends { readonly '$ref': string } ? InferRefType<T, TRoot, TReferences>
            : T extends { readonly '$dynamicRef': string } ? InferDynamicRefType<T, TRoot, TReferences>
              : T extends { readonly '$recursiveRef': string } ? InferRecursiveRefType<T, TRoot, TReferences>
              // Phase 4: Composition
                : T extends { readonly 'allOf': readonly unknown[] } ? InferAllOfType<T, TRoot, TReferences>
                  : T extends { readonly 'anyOf': readonly unknown[] } ? InferAnyOfType<T, TRoot, TReferences>
                    : T extends { readonly 'oneOf': readonly unknown[] } ? InferOneOfType<T, TRoot, TReferences>
                      : T extends { readonly 'if': unknown } ? InferConditionalType<T, TRoot, TReferences>
                      // Phase 5: Type-based
                        : T extends { readonly 'type': readonly unknown[] } ? InferTypeArrayType<T, TRoot, TReferences>
                          : T extends { readonly 'type': 'array' } ? InferArrayType<T, TRoot, TReferences>
                            : T extends { readonly 'type': 'object' } ? InferObjectType<T, TRoot, TReferences>
                              : InferPrimitiveType<T> extends never ? unknown : InferPrimitiveType<T>;

// ---------------------------------------------------------------------------
// Public helper types (re-exported via schema.ts)
// ---------------------------------------------------------------------------

export type {
  FindAnchorType,
  NavigateSchemaPathType,
  SplitFragmentRefType
};
