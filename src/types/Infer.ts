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
 * - `not` — Handles simple exclusions: `not: { type }`, `not: { const }`,
 *   `not: { enum }` use `Exclude` to narrow the inferred union. Complex `not`
 *   schemas (property-level, structural) fall back to the base type.
 * - `$dynamicRef` / `$recursiveRef` — Resolved as anchor lookup in the current
 *   root schema. Correct for same-schema usage; cross-schema falls back to
 *   `unknown` unless the consumer provides an explicit references map.
 * - `contains` — Inferred as `unknown[]`. Runtime validates at least one match;
 *   TypeScript cannot express "array with at least one element of type T".
 * - `propertyNames` — When `propertyNames: { enum: [...] }` is present, keys
 *   are narrowed to the enum union. Other `propertyNames` forms fall back to
 *   `Record<string, unknown>`.
 * - `unevaluatedProperties` / `unevaluatedItems` — Treated identically to
 *   `additionalProperties` / `additionalItems`. The "unevaluated" scoping
 *   across subschemas is a runtime concern.
 * - `patternProperties` — When the regex pattern is a simple anchored literal
 *   (e.g. `^data_`, `_id$`, `^exact$`), the key is inferred as a template
 *   literal type. Patterns with metacharacters fall back to `string`.
 * - `if/then/else` — When the `if` clause has a single const-discriminated
 *   property (e.g. `{ properties: { kind: { const: 'circle' } }, required: ['kind'] }`),
 *   the then branch is narrowed with the discriminator literal. Otherwise falls
 *   back to the sound over-approximation: union of possible branch outputs.
 */

import type {
  ContainsBrandInterface,
  ContentEncodingBrandInterface,
  ContentMediaTypeBrandInterface,
  DialectBrandInterface,
  ExclusiveMaximumBrandInterface,
  ExclusiveMinimumBrandInterface,
  FormatBrandInterface,
  MaximumBrandInterface,
  MaxItemsBrandInterface,
  MaxLengthBrandInterface,
  MaxPropertiesBrandInterface,
  MinimumBrandInterface,
  MinItemsBrandInterface,
  MinLengthBrandInterface,
  MinPropertiesBrandInterface,
  MultipleOfBrandInterface,
  PatternBrandInterface,
  SchemaIdBrandInterface,
  UniqueItemsBrandInterface
} from './ConstraintBrands.js';
import type { IsEnabledType } from './TypeConfig.js';
import type { TransformBrandInterface } from '../interfaces/TransformBrand.js';

// ---------------------------------------------------------------------------
// Recursion limits (type-level caps to prevent infinite expansion)
// ---------------------------------------------------------------------------

type TupleRecursionCap = 10;
type SchemaPointerDepthCap = 5;
type DeepPropertyDepthCap = 4;
type IntegerRangeCap = 50;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten an intersection into a single object type. */
type SimplifyType<T> = { [K in keyof T]: T[K] } & {};

/** Map a JSON Schema type name to the corresponding TypeScript primitive. */
type PrimitiveFromTypeNameType<U extends string>
  = U extends 'boolean' ? boolean
    : U extends 'integer' ? number
      : U extends 'null' ? null
        : U extends 'number' ? number
          : U extends 'string' ? string
            : never;

/**
 * Apply `not` keyword narrowing to an inferred type.
 * Handles `not: { type }`, `not: { const }`, and `not: { enum }`.
 * Complex `not` schemas fall through unchanged.
 */
type ApplyNotExclusionType<T, TResult>
  = T extends { readonly 'not': infer TNot }
    ? TNot extends { readonly 'const': infer V } ? Exclude<TResult, V>
      : TNot extends { readonly 'enum': ReadonlyArray<infer V> } ? Exclude<TResult, V>
        : TNot extends { readonly 'type': ReadonlyArray<infer U extends string> }
          ? Exclude<TResult, PrimitiveFromTypeNameType<U>>
          : TNot extends { readonly 'type': infer U extends string }
            ? Exclude<TResult, PrimitiveFromTypeNameType<U>>
            : TResult
    : TResult;

/** Intersect all values of a mapped type via function-parameter contravariance. */
type IntersectMappedValuesType<T>
  = [keyof T] extends [never] ? unknown
    : { [K in keyof T]: (x: T[K]) => void }[keyof T] extends (x: infer I) => void
      ? I
      : unknown;

// ---------------------------------------------------------------------------
// Pattern-to-template-literal helpers (patternProperties)
// ---------------------------------------------------------------------------

/**
 * Detect regex metacharacters in a string using template literal matching.
 * If any are found, the pattern is too complex for template literal conversion.
 * This is NOT regex parsing — it's checking for the absence of special characters.
 */
type HasRegexMetaType<TS extends string>
  = TS extends `${string}${
    '(' | ')' | '*' | '+' | '.' | '?' | '[' | '\\' | ']' | '{' | '|' | '}'
  }${string}`
    ? true
    : false;

/**
 * Map a regex pattern string to a TypeScript template literal key type.
 *
 * - `^prefix` (no metacharacters) → `` `prefix${string}` ``
 * - `suffix$` (no metacharacters) → `` `${string}suffix` ``
 * - `^exact$` (no metacharacters) → literal `'exact'`
 * - Anything with metacharacters or no anchors → `string` (safe fallback)
 */
type PatternToKeyType<TP extends string>
  // ^exact$ — full match, literal string
  = TP extends `^${infer Exact}$`
    ? HasRegexMetaType<Exact> extends true ? string : Exact
    // ^prefix — starts with
    : TP extends `^${infer Prefix}`
      ? HasRegexMetaType<Prefix> extends true ? string : `${Prefix}${string}`
      // suffix$ — ends with
      : TP extends `${infer Suffix}$`
        ? HasRegexMetaType<Suffix> extends true ? string : `${string}${Suffix}`
        // No anchors — fall back to string
        : string;

// ---------------------------------------------------------------------------
// Bound normalization helpers (integer ranges)
// ---------------------------------------------------------------------------

/** Normalize the lower bound to an inclusive value. Returns never when absent. */
type NormalizeMinType<T>
  = T extends { readonly 'exclusiveMinimum': infer TN extends number } ? Add1Type<TN>
    : T extends { readonly 'minimum': infer TN extends number } ? TN
      : never;

/** Normalize the upper bound to an inclusive value. Returns never when absent or Sub1 fails. */
type NormalizeMaxType<T>
  = T extends { readonly 'exclusiveMaximum': infer TN extends number } ? Sub1Type<TN>
    : T extends { readonly 'maximum': infer TN extends number } ? TN
      : never;

// ---------------------------------------------------------------------------
// Constraint brand helpers
// ---------------------------------------------------------------------------

/** Intersect string constraint brands onto string. */
type InferStringBrandsType<T>
  = (IsEnabledType<'contentBrands'> extends true
    ? (T extends { readonly 'contentEncoding': infer E extends string }
      ? ContentEncodingBrandInterface<E> : unknown)
      & (T extends { readonly 'contentMediaType': infer M extends string }
        ? ContentMediaTypeBrandInterface<M> : unknown)
    : unknown)
  & (IsEnabledType<'formatBrands'> extends true
    ? T extends { readonly 'format': infer F extends string } ? FormatBrandInterface<F> : unknown
    : unknown)
  & (IsEnabledType<'stringBrands'> extends true
    ? (T extends { readonly 'maxLength': infer N extends number } ? MaxLengthBrandInterface<N> : unknown)
      & (T extends { readonly 'minLength': infer N extends number } ? MinLengthBrandInterface<N> : unknown)
      & (T extends { readonly 'pattern': infer P extends string } ? PatternBrandInterface<P> : unknown)
    : unknown);

/** Intersect number constraint brands onto number. */
type InferNumberBrandsType<T>
  = (IsEnabledType<'formatBrands'> extends true
    ? T extends { readonly 'format': infer F extends string } ? FormatBrandInterface<F> : unknown
    : unknown)
  & (IsEnabledType<'numericBrands'> extends true
    ? (T extends { readonly 'exclusiveMaximum': infer N extends number } ? ExclusiveMaximumBrandInterface<N> : unknown)
      & (T extends { readonly 'exclusiveMinimum': infer N extends number } ? ExclusiveMinimumBrandInterface<N> : unknown)
      & (T extends { readonly 'maximum': infer N extends number } ? MaximumBrandInterface<N> : unknown)
      & (T extends { readonly 'minimum': infer N extends number } ? MinimumBrandInterface<N> : unknown)
      & (T extends { readonly 'multipleOf': infer N extends number } ? MultipleOfBrandInterface<N> : unknown)
    : unknown);

/** Intersect array constraint brands. */
type InferArrayBrandsType<T, TRoot, TReferences>
  = IsEnabledType<'arrayBrands'> extends true
    ? (T extends { readonly 'contains': infer C }
      ? ContainsBrandInterface<InferSchemaType<C, TRoot, TReferences>>
      : unknown)
      & (T extends { readonly 'maxItems': infer N extends number }
        ? MaxItemsBrandInterface<N> : unknown)
      & (T extends { readonly 'minItems': infer N extends number }
        ? MinItemsBrandInterface<N> : unknown)
      & (T extends { readonly 'uniqueItems': true } ? UniqueItemsBrandInterface : unknown)
    : unknown;

/** Intersect object constraint brands. */
type InferObjectBrandsType<T>
  = IsEnabledType<'objectBrands'> extends true
    ? (T extends { readonly 'maxProperties': infer N extends number }
      ? MaxPropertiesBrandInterface<N> : unknown)
      & (T extends { readonly 'minProperties': infer N extends number }
        ? MinPropertiesBrandInterface<N> : unknown)
    : unknown;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type InferPrimitiveType<T>
  = T extends { readonly 'type': 'string' } ? InferStringBrandsType<T> & string
    : T extends { readonly 'type': 'integer' }
      // Guard against never bounds (no bound or Sub1(0))
      ? [NormalizeMinType<T>] extends [never] ? InferNumberBrandsType<T> & number
        : [NormalizeMaxType<T>] extends [never] ? InferNumberBrandsType<T> & number
          : NormalizeMinType<T> extends infer TMin extends number
            ? NormalizeMaxType<T> extends infer TMax extends number
              ? T extends { readonly 'multipleOf': infer TStep extends number }
                ? MultipleOfRangeType<TMin, TMax, TStep>
                : IntegerRangeType<TMin, TMax>
              : InferNumberBrandsType<T> & number
            : InferNumberBrandsType<T> & number
      : T extends { readonly 'type': 'number' } ? InferNumberBrandsType<T> & number
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
// Array tuple helpers
// ---------------------------------------------------------------------------

/** Build a readonly tuple with exactly `TLen` elements of type `TItem`. Caps at 10. */
type BuildFixedTupleType<TItem, TLen extends number, TAccum extends unknown[] = []>
  = number extends TLen ? readonly TItem[]
    : TAccum['length'] extends TLen ? readonly [...TAccum]
      : TAccum['length'] extends TupleRecursionCap ? readonly [...TAccum]
        : BuildFixedTupleType<TItem, TLen, [...TAccum, TItem]>;

/** Build a readonly tuple with at least `TMin` elements of type `TItem`, then rest. Caps at 10. */
type BuildMinTupleType<TItem, TMin extends number, TAccum extends unknown[] = []>
  = number extends TMin ? readonly TItem[]
    : TAccum['length'] extends TMin ? readonly [...TAccum, ...TItem[]]
      : TAccum['length'] extends TupleRecursionCap ? readonly [...TAccum, ...TItem[]]
        : BuildMinTupleType<TItem, TMin, [...TAccum, TItem]>;

// ---------------------------------------------------------------------------
// Arrays
// ---------------------------------------------------------------------------

type InferArrayType<T, TRoot, TReferences>
  // prefixItems + items = tuple + rest
  = T extends { readonly 'items': infer I;
    readonly 'prefixItems': readonly [...infer TPrefix];
    readonly 'type': 'array' }
    ? readonly [...{ readonly [K in keyof TPrefix]: InferSchemaType<TPrefix[K], TRoot, TReferences> },
      ...Array<InferSchemaType<I, TRoot, TReferences>>]
    // items + minItems + maxItems (equal → fixed, unequal → min-length)
    : T extends { readonly 'items': infer I;
      readonly 'maxItems': infer TMax extends number;
      readonly 'minItems': infer TMin extends number;
      readonly 'type': 'array' }
      ? TMin extends TMax
        ? BuildFixedTupleType<InferSchemaType<I, TRoot, TReferences>, TMin>
        : BuildMinTupleType<InferSchemaType<I, TRoot, TReferences>, TMin>
      // items + minItems = min-length tuple
      : T extends { readonly 'items': infer I;
        readonly 'minItems': infer TMin extends number;
        readonly 'type': 'array' }
        ? BuildMinTupleType<InferSchemaType<I, TRoot, TReferences>, TMin>
        // items only
        : T extends { readonly 'items': infer I;
          readonly 'type': 'array' }
          ? ReadonlyArray<InferSchemaType<I, TRoot, TReferences>>
          // prefixItems only
          : T extends { readonly 'prefixItems': readonly [...infer TPrefix];
            readonly 'type': 'array' }
            ? readonly [...{ readonly [K in keyof TPrefix]: InferSchemaType<TPrefix[K], TRoot, TReferences> }]
            // contains only (no items) — element type narrows to contains schema
            : T extends { readonly 'contains': infer C;
              readonly 'type': 'array' }
              ? ReadonlyArray<InferSchemaType<C, TRoot, TReferences>>
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
  = T extends {
    readonly 'additionalProperties': false;
    readonly 'properties': infer P;
  }
    ? IsEnabledType<'objectBrands'> extends true
      ? Readonly<Partial<Record<Exclude<string, keyof P & string>, never>>>
      : unknown
    : T extends { readonly 'additionalProperties': false } ? unknown
      : T extends { readonly 'additionalProperties': infer A }
        ? { readonly [key: string]: InferSchemaType<A, TRoot, TReferences> }
        : unknown;

/**
 * Infer typed keys from patternProperties using template literal conversion.
 * Each pattern key is individually mapped to a template literal (or `string`
 * fallback), then all patterns are intersected.
 */
type InferPatternPropertiesType<TPP, TRoot, TReferences>
  = IntersectMappedValuesType<{
    [K in keyof TPP & string]: { readonly [P in PatternToKeyType<K>]?: InferSchemaType<TPP[K], TRoot, TReferences> }
  }>;

/** Merge dependentSchemas properties as optional (sound over-approximation). */
type InferDependentSchemasPropsType<T, TRoot, TReferences>
  = T extends { readonly 'dependentSchemas': infer DS }
    ? DS extends Record<string, unknown>
      ? Partial<InferAllDependentType<DS[keyof DS], TRoot, TReferences>>
      : unknown
    : unknown;

type InferAllDependentType<V, TRoot, TReferences>
  = V extends {
    readonly 'properties': unknown;
    readonly 'type': 'object';
  }
    ? InferSchemaType<V, TRoot, TReferences>
    : unknown;

/**
 * Model dependentRequired as a per-trigger union constraint.
 * For each trigger key K with dependents [D1, D2]:
 *   - Either K is absent (type never, no constraint on dependents)
 *   - Or all dependents must be present (required)
 * Per-trigger unions are intersected so all triggers apply simultaneously.
 */
type InferDependentRequiredType<T>
  = T extends { readonly 'dependentRequired': infer DR extends Record<string, readonly string[]> }
    ? IntersectMappedValuesType<{
      [K in keyof DR & string]:
        Readonly<Partial<Record<K, never>>>
        | Readonly<Record<DR[K][number] & string, unknown>>
    }>
    : unknown;

type InferObjectType<T, TRoot, TReferences>
  = T extends { readonly 'properties': infer TProps;
    readonly 'type': 'object' }
    ? InferAdditionalType<T, TRoot, TReferences>
      & InferDependentRequiredType<T>
      & InferDependentSchemasPropsType<T, TRoot, TReferences>
      & InferObjectBrandsType<T>
      & InferObjectTypePropsType<TProps, ExtractRequiredKeysType<T>, TRoot, TReferences>
    : T extends { readonly 'patternProperties': infer PP;
      readonly 'type': 'object' }
      ? InferObjectBrandsType<T>
        & (PP extends Record<string, unknown>
          ? InferPatternPropertiesType<PP, TRoot, TReferences>
          : Record<string, unknown>)
      // propertyNames: { enum } — strict key set
      : T extends {
        readonly 'propertyNames': { readonly 'enum': ReadonlyArray<infer K extends string> };
        readonly 'type': 'object';
      }
        ? InferObjectBrandsType<T>
          & (T extends { readonly 'additionalProperties': infer A }
            ? { readonly [P in K]?: InferSchemaType<A, TRoot, TReferences> }
            : { readonly [P in K]?: unknown })
        : T extends { readonly 'type': 'object' }
          ? InferObjectBrandsType<T> & Record<string, unknown>
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
  = T extends { readonly 'discriminator': { readonly 'propertyName': infer P extends string };
    readonly 'oneOf': ReadonlyArray<infer V> }
    ? InferSchemaType<V, TRoot, TReferences> & { readonly [K in P]: unknown }
    : T extends { readonly 'oneOf': ReadonlyArray<infer V> }
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
type SplitFragmentRefType<TRef extends string, TRoot, TReferences = Record<never, never>>
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
  = U extends 'string' ? InferStringBrandsType<T> & string
    : U extends 'integer'
      ? [NormalizeMinType<T>] extends [never] ? InferNumberBrandsType<T> & number
        : [NormalizeMaxType<T>] extends [never] ? InferNumberBrandsType<T> & number
          : NormalizeMinType<T> extends infer TMin extends number
            ? NormalizeMaxType<T> extends infer TMax extends number
              ? T extends { readonly 'multipleOf': infer TStep extends number }
                ? MultipleOfRangeType<TMin, TMax, TStep>
                : IntegerRangeType<TMin, TMax>
              : InferNumberBrandsType<T> & number
            : InferNumberBrandsType<T> & number
      : U extends 'number' ? InferNumberBrandsType<T> & number
        : U extends 'boolean' ? boolean
          : U extends 'null' ? null
            : U extends 'array' ? InferArrayBrandsType<T, TRoot, TReferences> & InferArrayType<T, TRoot, TReferences>
              : U extends 'object' ? InferObjectType<T, TRoot, TReferences>
                : never;

type InferTypeArrayType<T, TRoot, TReferences>
  = T extends { readonly 'type': ReadonlyArray<infer U extends string> }
    ? InferSingleTypeType<U, T, TRoot, TReferences>
    : never;

type WithoutConditionalType<T>
  = T extends object ? Omit<T, 'else' | 'if' | 'then'> : T;

/**
 * Extract a const-discriminated property from an if clause.
 * Resolves to `{ key: K; value: V }` when the if clause has a single const
 * property that is also required. Falls back to `never` otherwise.
 */
type ExtractIfConstDiscriminatorType<TIf>
  = TIf extends {
    readonly 'properties': infer P;
    readonly 'required': ReadonlyArray<infer TReq extends string>;
  }
    ? keyof P & string extends infer K extends string
      ? [K] extends [TReq]
        ? P extends Readonly<Record<K, { readonly 'const': infer V }>>
          ? {
            'key': K;
            'value': V;
          }
          : never
        : never
      : never
    : never;

type InferConditionalType<T, TRoot, TReferences>
  = T extends { readonly 'if': infer TIf }
    // Const-discriminated narrowing: if has { properties: { K: { const: V } }, required: [K] }
    ? ExtractIfConstDiscriminatorType<TIf> extends {
      'key': infer K extends string;
      'value': infer V;
    }
      ? T extends {
        readonly 'else': infer TElse;
        readonly 'then': infer TThen;
      }
        ? InferSchemaType<TElse & WithoutConditionalType<T>, TRoot, TReferences>
          | SimplifyType<InferSchemaType<TThen & WithoutConditionalType<T>, TRoot, TReferences>
            & { readonly [P in K]: V }>
        : T extends { readonly 'then': infer TThen }
          ? InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
            | SimplifyType<InferSchemaType<TThen & WithoutConditionalType<T>, TRoot, TReferences>
              & { readonly [P in K]: V }>
          : InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
      // Fallback: union-of-branches approximation (no const discriminator detected)
      : T extends { readonly 'else': infer TElse;
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

/** Core dispatcher — structural inference without `not` narrowing. */
type InferSchemaTypeCoreType<T, TRoot = T, TReferences = Record<never, never>>
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
                          : T extends { readonly 'type': 'array' } ? InferArrayBrandsType<T, TRoot, TReferences> & InferArrayType<T, TRoot, TReferences>
                            : T extends { readonly 'type': 'object' } ? InferObjectType<T, TRoot, TReferences>
                              : InferPrimitiveType<T> extends never ? unknown : InferPrimitiveType<T>;

/**
 * Infer a TypeScript type from a JSON Schema literal type.
 *
 * Wraps the core dispatcher with `not` keyword exclusion so that
 * `not: { type }`, `not: { const }`, and `not: { enum }` narrow the result.
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 */
export type InferSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = ApplyNotExclusionType<T, InferSchemaTypeCoreType<T, TRoot, TReferences>>;

/**
 * Nominal schema type — adds `$id` and `$schema` phantom brands on top of
 * the structural type inferred by `InferSchemaType`.
 *
 * Schemas with different `$id` values produce incompatible types even when
 * structurally identical. Use this for top-level schemas that need nominal
 * distinction; sub-schemas without `$id` remain structural.
 */
export type NominalSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = InferSchemaType<T, TRoot, TReferences>
    & (IsEnabledType<'nominalBrands'> extends true
      ? (T extends { readonly '$id': infer TId extends string }
        ? SchemaIdBrandInterface<TId> : unknown)
        & (T extends { readonly '$schema': infer D extends string }
          ? DialectBrandInterface<D> : unknown)
      : unknown);

// ---------------------------------------------------------------------------
// Public helper types (re-exported via schema.ts)
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Schema pointer paths — compile-time JSON Pointer autocomplete
// ---------------------------------------------------------------------------

type PrefixPointerType<TPrefix extends string, TSuffix>
  = TSuffix extends string ? `${TPrefix}${TSuffix}` : never;

/**
 * Derive valid JSON Pointer paths from a schema type.
 * Provides IDE autocomplete for `subschemaAt()` pointer arguments.
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TDepth - Internal recursion limiter (do not set manually).
 */
export type SchemaPointerPathsType<T, TDepth extends unknown[] = []>
  = TDepth['length'] extends SchemaPointerDepthCap ? never
    : (T extends { readonly '$defs': infer D }
      ? { [K in keyof D & string]:
        | `/$defs/${K}`
        | PrefixPointerType<`/$defs/${K}`, SchemaPointerPathsType<D[K], [...TDepth, unknown]>>
      }[keyof D & string]
      : never)
    | (T extends { readonly 'additionalProperties': infer AP }
      ? AP extends boolean
        ? '/additionalProperties'
        : '/additionalProperties'
          | PrefixPointerType<'/additionalProperties', SchemaPointerPathsType<AP, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'allOf': readonly [...infer TItems] }
      ? { [K in `${number}` & keyof TItems]:
        | `/allOf/${K}`
        | PrefixPointerType<`/allOf/${K}`, SchemaPointerPathsType<TItems[K], [...TDepth, unknown]>>
      }[`${number}` & keyof TItems]
      : never)
    | (T extends { readonly 'anyOf': readonly [...infer TItems] }
      ? { [K in `${number}` & keyof TItems]:
        | `/anyOf/${K}`
        | PrefixPointerType<`/anyOf/${K}`, SchemaPointerPathsType<TItems[K], [...TDepth, unknown]>>
      }[`${number}` & keyof TItems]
      : never)
    | (T extends { readonly 'contains': infer C }
      ? '/contains' | PrefixPointerType<'/contains', SchemaPointerPathsType<C, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'dependentSchemas': infer DS }
      ? { [K in keyof DS & string]:
        | `/dependentSchemas/${K}`
        | PrefixPointerType<`/dependentSchemas/${K}`, SchemaPointerPathsType<DS[K], [...TDepth, unknown]>>
      }[keyof DS & string]
      : never)
    | (T extends { readonly 'else': infer TElse }
      ? '/else' | PrefixPointerType<'/else', SchemaPointerPathsType<TElse, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'if': infer TIf }
      ? '/if' | PrefixPointerType<'/if', SchemaPointerPathsType<TIf, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'items': infer I }
      ? '/items' | PrefixPointerType<'/items', SchemaPointerPathsType<I, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'not': infer N }
      ? '/not' | PrefixPointerType<'/not', SchemaPointerPathsType<N, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'oneOf': readonly [...infer TItems] }
      ? { [K in `${number}` & keyof TItems]:
        | `/oneOf/${K}`
        | PrefixPointerType<`/oneOf/${K}`, SchemaPointerPathsType<TItems[K], [...TDepth, unknown]>>
      }[`${number}` & keyof TItems]
      : never)
    | (T extends { readonly 'patternProperties': infer PP }
      ? { [K in keyof PP & string]:
        | `/patternProperties/${K}`
        | PrefixPointerType<`/patternProperties/${K}`, SchemaPointerPathsType<PP[K], [...TDepth, unknown]>>
      }[keyof PP & string]
      : never)
    | (T extends { readonly 'prefixItems': readonly [...infer TPrefix] }
      ? { [K in `${number}` & keyof TPrefix]:
        | `/prefixItems/${K}`
        | PrefixPointerType<`/prefixItems/${K}`, SchemaPointerPathsType<TPrefix[K], [...TDepth, unknown]>>
      }[`${number}` & keyof TPrefix]
      : never)
    | (T extends { readonly 'properties': infer P }
      ? { [K in keyof P & string]:
        | `/properties/${K}`
        | PrefixPointerType<`/properties/${K}`, SchemaPointerPathsType<P[K], [...TDepth, unknown]>>
      }[keyof P & string]
      : never)
    | (T extends { readonly 'propertyNames': infer PN }
      ? '/propertyNames' | PrefixPointerType<'/propertyNames', SchemaPointerPathsType<PN, [...TDepth, unknown]>>
      : never)
    | (T extends { readonly 'then': infer TThen }
      ? '/then' | PrefixPointerType<'/then', SchemaPointerPathsType<TThen, [...TDepth, unknown]>>
      : never);

// ---------------------------------------------------------------------------
// Materialized type — required + defaulted properties are non-optional
// ---------------------------------------------------------------------------

/** Extract property keys that declare a default value. */
type PropertiesWithDefaultType<TProps>
  = { [K in keyof TProps & string]: TProps[K] extends { readonly 'default': unknown } ? K : never
  }[keyof TProps & string];

/**
 * Type returned by `materialize()` — required fields and fields with defaults
 * are non-optional, all others remain optional.
 */
export type MaterializedSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = T extends { readonly 'properties': infer TProps;
    readonly 'type': 'object' }
    ? SimplifyType<
      { readonly [K in keyof TProps & string
        as K extends ExtractRequiredKeysType<T> | PropertiesWithDefaultType<TProps> ? K : never]:
        InferSchemaType<TProps[K], TRoot, TReferences> }
      & { readonly [K in keyof TProps & string
        as K extends ExtractRequiredKeysType<T> | PropertiesWithDefaultType<TProps> ? never : K]?:
        InferSchemaType<TProps[K], TRoot, TReferences> }
    >
    : InferSchemaType<T, TRoot, TReferences>;

// ---------------------------------------------------------------------------
// Property paths — dot-notation paths for utility work
// ---------------------------------------------------------------------------

/** Extract top-level property names from a schema. */
export type PropertyPathsType<T>
  = T extends { readonly 'properties': infer P }
    ? keyof P & string
    : never;

/** Extract nested property paths (dot-notation) from a schema, depth-limited. */
export type DeepPropertyPathsType<T, TDepth extends unknown[] = []>
  = TDepth['length'] extends DeepPropertyDepthCap ? never
    : T extends { readonly 'properties': infer P }
      ? { [K in keyof P & string]:
        | (DeepPropertyPathsType<P[K], [...TDepth, unknown]> extends infer TChild extends string
          ? `${K}.${TChild}`
          : never)
        | K
      }[keyof P & string]
      : never;

// ---------------------------------------------------------------------------
// readOnly / writeOnly filtering
// ---------------------------------------------------------------------------

/** Extract keys of properties marked `readOnly: true`. */
export type ReadOnlyKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'readOnly': true } ? K : never
    }[keyof P & string]
    : never;

/** Extract keys of properties marked `writeOnly: true`. */
export type WriteOnlyKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'writeOnly': true } ? K : never
    }[keyof P & string]
    : never;

/** Schema type for API input — excludes readOnly properties (server-generated). */
export type InputSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = T extends { readonly 'properties': unknown;
    readonly 'type': 'object' }
    ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, ReadOnlyKeysType<T>>>
    : InferSchemaType<T, TRoot, TReferences>;

/** Schema type for API output — excludes writeOnly properties (client-only input). */
export type OutputSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = T extends { readonly 'properties': unknown;
    readonly 'type': 'object' }
    ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, WriteOnlyKeysType<T>>>
    : InferSchemaType<T, TRoot, TReferences>;

// ---------------------------------------------------------------------------
// Deprecated property filtering
// ---------------------------------------------------------------------------

/** Extract keys of properties marked `deprecated: true`. */
export type DeprecatedKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'deprecated': true } ? K : never
    }[keyof P & string]
    : never;

/** Schema type excluding deprecated properties. */
export type NonDeprecatedSchemaType<T, TRoot = T, TReferences = Record<never, never>>
  = T extends { readonly 'properties': unknown;
    readonly 'type': 'object' }
    ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, DeprecatedKeysType<T>>>
    : InferSchemaType<T, TRoot, TReferences>;

// ---------------------------------------------------------------------------
// Discriminator property extraction
// ---------------------------------------------------------------------------

/** Extract the discriminator property name from a schema with `discriminator.propertyName`. */
export type DiscriminatorPropertyType<T>
  = T extends { readonly 'discriminator': { readonly 'propertyName': infer P extends string } }
    ? P : never;

// ---------------------------------------------------------------------------
// Integer range utility
// ---------------------------------------------------------------------------

/** Tuple of length TN (capped at 50). Used for type-level arithmetic. */
type BuildTupleType<TN extends number, T extends unknown[] = []>
  = T['length'] extends TN ? T
    : T['length'] extends IntegerRangeCap ? T
      : BuildTupleType<TN, [...T, unknown]>;

/** Increment a non-negative integer literal by 1. */
type Add1Type<TN extends number>
  = [...BuildTupleType<TN>, unknown]['length'] & number;

/** Decrement a positive integer literal by 1. Returns never for 0. */
type Sub1Type<TN extends number>
  = BuildTupleType<TN> extends [unknown, ...infer R] ? number & R['length'] : never;

/** Build an integer range union type. Caps at 50 to avoid recursion limits. */
type BuildIntegerRangeType<
  TMin extends number, TMax extends number,
  TAccum extends unknown[] = [], TStarted extends boolean = false
>
  = TAccum['length'] extends IntegerRangeCap ? number
    : TAccum['length'] extends TMax
      ? TStarted extends true ? TMax
        : TAccum['length'] extends TMin ? TMax
          : never
      : TStarted extends true
        ? BuildIntegerRangeType<TMin, TMax, [...TAccum, unknown], true> | TAccum['length']
        : TAccum['length'] extends TMin
          ? BuildIntegerRangeType<TMin, TMax, [...TAccum, unknown], true> | TAccum['length']
          : BuildIntegerRangeType<TMin, TMax, [...TAccum, unknown]>;

/**
 * Produce a union of integer literals from Min to Max (inclusive).
 * Only practical for small non-negative ranges (0–50).
 *
 * @example
 * type Rating = IntegerRangeType<1, 5>;  // 1 | 2 | 3 | 4 | 5
 */
export type IntegerRangeType<TMin extends number, TMax extends number>
  = number extends TMin ? number
    : number extends TMax ? number
      : BuildIntegerRangeType<TMin, TMax>;

/**
 * Build a stepped integer range. Starts at 0, increments by TStep,
 * includes values within [TMin, TMax]. Caps at 50 iterations.
 *
 * Uses tuple arithmetic for comparison:
 * - `BuildTupleType<TMax> extends [...TCurrent, ...unknown[]]` = TMax >= TCurrent.length
 * - `TCurrent extends [...BuildTupleType<TMin>, ...unknown[]]` = TCurrent.length >= TMin
 */
type BuildMultipleOfRangeType<
  TMin extends number, TMax extends number, TStep extends number,
  TCurrent extends unknown[] = [], TResult = never,
  TDepth extends unknown[] = []
>
  = TDepth['length'] extends IntegerRangeCap ? number
    : BuildTupleType<TMax> extends [...TCurrent, ...unknown[]]
      ? BuildMultipleOfRangeType<
        TMin, TMax, TStep,
        [...TCurrent, ...BuildTupleType<TStep>],
        TCurrent extends [...BuildTupleType<TMin>, ...unknown[]]
          ? TCurrent['length'] | TResult
          : TResult,
        [...TDepth, unknown]
      >
      : TResult;

/**
 * Produce a union of integer literals that are multiples of TStep within [TMin, TMax].
 *
 * @example
 * type Evens = MultipleOfRangeType<0, 10, 2>;  // 0 | 2 | 4 | 6 | 8 | 10
 */
export type MultipleOfRangeType<
  TMin extends number, TMax extends number, TStep extends number
>
  = number extends TMin ? number
    : number extends TMax ? number
      : number extends TStep ? number
        : BuildMultipleOfRangeType<TMin, TMax, TStep>;

// ---------------------------------------------------------------------------
// Default alignment — resolves to never when defaults mismatch declared type
// ---------------------------------------------------------------------------

/** Check whether every property with a `default` has a value matching its declared `type`. */
type CheckPropertyDefaultsType<TP>
  = { [K in keyof TP]:
    TP[K] extends {
      readonly 'default': infer D;
      readonly 'type': 'string';
    }
      ? D extends string ? true : false
      : TP[K] extends {
        readonly 'default': infer D;
        readonly 'type': 'boolean';
      }
        ? D extends boolean ? true : false
        : TP[K] extends {
          readonly 'default': infer D;
          readonly 'type': 'integer' | 'number';
        }
          ? D extends number ? true : false
          : true
  } extends { [K in keyof TP]: true } ? true : false;

/** Resolves to the schema type T when all defaults match, otherwise never. */
export type DefaultAlignedType<T>
  = T extends { readonly 'properties': infer TP }
    ? CheckPropertyDefaultsType<TP> extends true ? T : never
    : T;

// ---------------------------------------------------------------------------
// Enum exhaustiveness
// ---------------------------------------------------------------------------

/** Extract the union of literal values from an enum schema. */
export type EnumValuesType<T>
  = T extends { readonly 'enum': ReadonlyArray<infer V> } ? V : never;

/** Marker type for exhaustiveness checks — only accepts `never`. */
export type ExhaustiveType<T extends never> = T;

// ---------------------------------------------------------------------------
// Loose input hint
// ---------------------------------------------------------------------------

/**
 * Strip constraint brands, returning the base primitive type.
 * Exported as a standalone utility — NOT applied to method signatures.
 *
 * Uses `[T] extends [X]` to prevent distribution over unions.
 */
export type LooseInputType<T>
  = [T] extends [string] ? string
    : [T] extends [number] ? number
      : [T] extends [boolean] ? boolean
        : [T] extends [readonly unknown[]] ? readonly unknown[]
          : [T] extends [Record<string, unknown>] ? Record<string, unknown>
            : unknown;

export type {
  FindAnchorType,
  NavigateSchemaPathType,
  SplitFragmentRefType
};
