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
 *   are narrowed to the enum union. When `propertyNames: { pattern: P }` is
 *   present with a recognised anchored pattern, keys are narrowed to the
 *   corresponding template-literal type via `PatternToKeyType` (same rules as
 *   `patternProperties`). Other `propertyNames` forms fall back to
 *   `Record<string, unknown>`.
 * - `pattern` (on `type: 'string'`) — When `tightStringLengths` is enabled and
 *   the pattern is a recognised anchored shape, the value type is additionally
 *   narrowed via `PatternToKeyType` (same rules as `patternProperties`). Complex
 *   or unanchored patterns leave the value type as plain `string`.
 * - `unevaluatedProperties` / `unevaluatedItems` — Treated identically to
 *   `additionalProperties` / `additionalItems`. The "unevaluated" scoping
 *   across subschemas is a runtime concern.
 * - `patternProperties` — Anchored regex shapes are mapped to template
 *   literal key types: `^prefix` → `\`prefix${string}\``, `suffix$` →
 *   `\`${string}suffix\``, `^exact$` → literal, `^(a|b|c)$` → literal union,
 *   `^[class]+suffix$` → `\`${string}suffix\``, `^.{N}$` (small N) →
 *   length-N character template literal. Unrecognised patterns fall back
 *   to `string`.
 * - `if/then/else` — When the `if` clause has a single const-discriminated
 *   property (e.g. `{ properties: { kind: { const: 'circle' } }, required: ['kind'] }`),
 *   the then branch is narrowed with the discriminator literal. Otherwise falls
 *   back to the sound over-approximation: union of possible branch outputs.
 */

import type {
  ContainsBrandType,
  ContentEncodingBrandType,
  ContentMediaTypeBrandType,
  DialectBrandType,
  ExclusiveMaximumBrandType,
  ExclusiveMinimumBrandType,
  FormatBrandType,
  MaxContainsBrandType,
  MaximumBrandType,
  MaxItemsBrandType,
  MaxLengthBrandType,
  MaxPropertiesBrandType,
  MinContainsBrandType,
  MinimumBrandType,
  MinItemsBrandType,
  MinLengthBrandType,
  MinPropertiesBrandType,
  MultipleOfBrandType,
  PatternBrandType,
  SchemaIdBrandType,
  UniqueArrayBrandType
} from './ConstraintBrands.js';
import type {
  BuildAtLeastTupleType,
  BuildAtMostTupleType,
  BuildBoundedTupleType,
  BuildExactTupleType
} from './RestrictionInfer.js';
import type { IsEnabledType } from './TypeConfig.js';
import type {
  AnchorNotFoundType,
  RefNotFoundType
} from './TypeErrors.js';
import type { TransformBrandType } from '../types/TransformBrandType.js';
import type { JsonTologyReferencesInterface } from './SchemaReferences.js';

// ---------------------------------------------------------------------------
// Recursion limits (type-level caps to prevent infinite expansion)
// ---------------------------------------------------------------------------

declare const _SCHEMA_POINTER_DEPTH_CAP: 5;
declare const _DEEP_PROPERTY_DEPTH_CAP: 4;
declare const _INTEGER_RANGE_CAP: 50;
declare const _STRING_LENGTH_CAP: 8;

type SchemaPointerDepthCap = typeof _SCHEMA_POINTER_DEPTH_CAP;
type DeepPropertyDepthCap = typeof _DEEP_PROPERTY_DEPTH_CAP;
type IntegerRangeCap = typeof _INTEGER_RANGE_CAP;
type StringLengthCap = typeof _STRING_LENGTH_CAP;

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
 * Split an alternation body (`a|b|c`) into the union of its branches. Each
 * branch must be free of further metacharacters; otherwise the alternation
 * collapses to `string`.
 */
type AlternationToUnionType<TBody extends string>
  = TBody extends `${infer THead}|${infer TTail}`
    ? HasRegexMetaType<THead> extends true
      ? string
      : AlternationToUnionType<TTail> | THead
    : HasRegexMetaType<TBody> extends true
      ? string
      : TBody;

/**
 * Build a length-N tuple of `string` segments. Used to express `^.{N}$` as a
 * string of exactly N characters. Caps at {@link StringLengthCap}; above the
 * cap it falls back to plain `string`.
 */
type BuildStringSegmentsType<TLen extends number, TAccum extends string[] = []>
  = TAccum['length'] extends TLen ? TAccum
    : TAccum['length'] extends StringLengthCap ? TAccum
      : BuildStringSegmentsType<TLen, [...TAccum, string]>;

/** Concatenate a tuple of segments into a single template literal. */
type JoinSegmentsType<TSegs extends readonly string[]>
  = TSegs extends readonly [infer THead extends string, ...infer TTail extends string[]]
    ? `${THead}${JoinSegmentsType<TTail>}`
    : '';

/**
 * Express `^.{N}$` as a length-N character template literal. For N greater
 * than {@link StringLengthCap}, fall back to `string`.
 */
type FixedDotLengthType<TLen extends number>
  = number extends TLen ? string
    : BuildStringSegmentsType<TLen> extends infer TSegs extends readonly string[]
      ? TSegs['length'] extends TLen ? JoinSegmentsType<TSegs> : string
      : string;

/**
 * Detect a character-class + literal-suffix shape, e.g. `[a-z]+_id`. The
 * suffix must be free of further metacharacters. The character-class portion
 * is treated structurally as `string` (TypeScript cannot bind char ranges;
 * the runtime regex still enforces the actual class).
 */
type CharClassPlusSuffixType<TBody extends string>
  = TBody extends `[${string}]${'*' | '+'}${infer TSuffix}`
    ? HasRegexMetaType<TSuffix> extends true
      ? string
      : `${string}${TSuffix}`
    : never;

/**
 * Map a regex pattern string to a TypeScript template literal key type.
 *
 * Anchored shapes recognised; unhandled shapes fall back to `string`:
 *
 * - `^exact$` (no metacharacters) → literal `'exact'`
 * - `^(a|b|c)$` (alternation of literals) → `'a' | 'b' | 'c'`
 * - `^.{N}$` (small N ≤ {@link StringLengthCap}) → length-N template literal
 * - `^[class]+suffix$` / `^[class]*suffix$` → `\`${string}suffix\``
 * - `^prefix` (no metacharacters) → `\`prefix${string}\``
 * - `suffix$` (no metacharacters) → `\`${string}suffix\``
 * - everything else → `string`
 */
type PatternToKeyType<TP extends string>
  // ^(a|b|c)$ — alternation of literal branches
  = TP extends `^(${infer TBody})$`
    ? AlternationToUnionType<TBody>
    // ^.{N}$ — exact length string for small N
    : TP extends `^.{${infer TLen extends number}}$`
      ? FixedDotLengthType<TLen>
      // ^[class]+suffix$ / ^[class]*suffix$ — char class + literal suffix
      : TP extends `^${infer TBody}$`
        ? CharClassPlusSuffixType<TBody> extends infer TCC
          ? [TCC] extends [never]
            // Fall through to existing exact-literal handling
            ? HasRegexMetaType<TBody> extends true ? string : TBody
            : TCC
          : string
        // ^prefix — starts with literal prefix
        : TP extends `^${infer Prefix}`
          ? HasRegexMetaType<Prefix> extends true ? string : `${Prefix}${string}`
          // suffix$ — ends with literal suffix
          : TP extends `${infer Suffix}$`
            ? HasRegexMetaType<Suffix> extends true ? string : `${string}${Suffix}`
            // No anchors — fall back to string
            : string;

// ---------------------------------------------------------------------------
// Tight string-length narrowing helpers (Finding 20)
// ---------------------------------------------------------------------------

/**
 * Build a length-N character template literal type — `string` repeated N
 * times. Caps at {@link StringLengthCap}; above the cap the type widens to
 * plain `string`.
 */
type FixedLengthStringType<TLen extends number>
  = number extends TLen ? string
    : FixedDotLengthType<TLen>;

/**
 * Narrow a string by `minLength` / `maxLength`, only when the type-config
 * has `tightStringLengths` enabled. Narrowing applies when both bounds are
 * present and within {@link StringLengthCap}:
 *
 * - `minLength === maxLength === N` → length-N template literal
 * - `minLength < maxLength`, both ≤ cap → union of length-N templates
 * - everything else → plain `string`
 */
type TightStringLengthType<T>
  = IsEnabledType<'tightStringLengths'> extends true
    ? T extends {
      readonly 'maxLength': infer TMax extends number;
      readonly 'minLength': infer TMin extends number;
    }
      ? TMin extends TMax
        ? FixedLengthStringType<TMin>
        : BuildLengthRangeType<TMin, TMax>
      : T extends { readonly 'maxLength': infer TMax extends number }
        ? BuildLengthRangeType<0, TMax>
        : string
    : string;

/**
 * Build a union of fixed-length string template literals for every integer
 * length between `TMin` and `TMax` inclusive. Caps at {@link StringLengthCap};
 * any length above the cap pulls the whole union back to `string`.
 */
type BuildLengthRangeType<
  TMin extends number, TMax extends number,
  TAccum extends unknown[] = [], TResult = never
>
  = TAccum['length'] extends StringLengthCap
    ? string
    : BuildTupleType<TMax> extends [...TAccum, ...unknown[]]
      ? BuildLengthRangeType<
        TMin, TMax,
        [...TAccum, unknown],
        TAccum extends [...BuildTupleType<TMin>, ...unknown[]]
          ? FixedLengthStringType<number & TAccum['length']> | TResult
          : TResult
      >
      : TResult;

/**
 * Narrow a string's value type by its `pattern` keyword, gated on the
 * `tightStringLengths` flag (reuses the same flag — both are tight value
 * narrowings for strings). Delegates to {@link PatternToKeyType}; unrecognised
 * or unanchored patterns resolve to `string`, making the intersection a no-op.
 *
 * This is intentionally intersected with the brand + length types, not with
 * `string` directly: the brand intersection preserves the phantom constraint
 * markers while the value-space narrows to the template literal or literal
 * union.
 */
type TightStringPatternType<T>
  = IsEnabledType<'tightStringLengths'> extends true
    ? T extends { readonly 'pattern': infer P extends string }
      ? PatternToKeyType<P>
      : unknown
    : unknown;

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
      ? ContentEncodingBrandType<E> : unknown)
      & (T extends { readonly 'contentMediaType': infer M extends string }
        ? ContentMediaTypeBrandType<M> : unknown)
    : unknown)
  & (IsEnabledType<'formatBrands'> extends true
    ? T extends { readonly 'format': infer F extends string } ? FormatBrandType<F> : unknown
    : unknown)
  & (IsEnabledType<'stringBrands'> extends true
    ? (T extends { readonly 'maxLength': infer N extends number } ? MaxLengthBrandType<N> : unknown)
      & (T extends { readonly 'minLength': infer N extends number } ? MinLengthBrandType<N> : unknown)
      & (T extends { readonly 'pattern': infer P extends string } ? PatternBrandType<P> : unknown)
    : unknown);

/** Intersect number constraint brands onto number. */
type InferNumberBrandsType<T>
  = (IsEnabledType<'formatBrands'> extends true
    ? T extends { readonly 'format': infer F extends string } ? FormatBrandType<F> : unknown
    : unknown)
  & (IsEnabledType<'numericBrands'> extends true
    ? (T extends { readonly 'exclusiveMaximum': infer N extends number } ? ExclusiveMaximumBrandType<N> : unknown)
      & (T extends { readonly 'exclusiveMinimum': infer N extends number } ? ExclusiveMinimumBrandType<N> : unknown)
      & (T extends { readonly 'maximum': infer N extends number } ? MaximumBrandType<N> : unknown)
      & (T extends { readonly 'minimum': infer N extends number } ? MinimumBrandType<N> : unknown)
      & (T extends { readonly 'multipleOf': infer N extends number } ? MultipleOfBrandType<N> : unknown)
    : unknown);

/** Intersect array constraint brands. */
type InferArrayBrandsType<T, TRoot, TReferences>
  = IsEnabledType<'arrayBrands'> extends true
    ? (T extends { readonly 'contains': infer C }
      ? ContainsBrandType<InferSchemaType<C, TRoot, TReferences>>
      : unknown)
      & (T extends { readonly 'maxContains': infer N extends number }
        ? MaxContainsBrandType<N> : unknown)
      & (T extends { readonly 'maxItems': infer N extends number }
        ? MaxItemsBrandType<N> : unknown)
      & (T extends { readonly 'minContains': infer N extends number }
        ? MinContainsBrandType<N> : unknown)
      & (T extends { readonly 'minItems': infer N extends number }
        ? MinItemsBrandType<N> : unknown)
      & (T extends { readonly 'uniqueItems': true }
        ? T extends { readonly 'items': infer I }
          ? UniqueArrayBrandType<InferSchemaType<I, TRoot, TReferences>>
          : unknown
        : unknown)
    : unknown;

/** Intersect object constraint brands. */
type InferObjectBrandsType<T>
  = IsEnabledType<'objectBrands'> extends true
    ? (T extends { readonly 'maxProperties': infer N extends number }
      ? MaxPropertiesBrandType<N> : unknown)
      & (T extends { readonly 'minProperties': infer N extends number }
        ? MinPropertiesBrandType<N> : unknown)
    : unknown;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

type InferPrimitiveType<T>
  = T extends { readonly 'type': 'string' } ? InferStringBrandsType<T> & TightStringLengthType<T> & TightStringPatternType<T>
    : T extends { readonly 'type': 'integer' }
      // Guard against never bounds (no bound or Sub1(0))
      ? [NormalizeMinType<T>] extends [never] ? InferNumberBrandsType<T> & number
        : [NormalizeMaxType<T>] extends [never] ? InferNumberBrandsType<T> & number
          : IsEnabledType<'tightIntegerRanges'> extends true
            ? NormalizeMinType<T> extends infer TMin extends number
              ? NormalizeMaxType<T> extends infer TMax extends number
                ? T extends { readonly 'multipleOf': infer TStep extends number }
                  ? MultipleOfRangeType<TMin, TMax, TStep>
                  : IntegerRangeType<TMin, TMax>
                : InferNumberBrandsType<T> & number
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
// Arrays
// ---------------------------------------------------------------------------

/**
 * Narrow an array element type by `minItems` / `maxItems` to a tuple shape.
 *
 * - `min === max` → fixed-length tuple `[T, T, ..., T]` (length N)
 * - `min > 0`, no max → `[T, ..., T, ...T[]]` (non-empty prefix + variadic tail)
 * - `max`, no min → union of tuples length `0..max`
 * - both, `min < max` → union of tuples length `min..max`
 *
 * Capped at `TupleCapType = 16`. Above the cap, falls through to
 * `ReadonlyArray<TItem>`.
 */
type NarrowArrayByItemsBoundsType<TItem, T>
  = T extends {
    readonly 'maxItems': infer TMax extends number;
    readonly 'minItems': infer TMin extends number;
  }
    ? TMin extends TMax
      ? BuildExactTupleType<TItem, TMin>
      : BuildBoundedTupleType<TItem, TMin, TMax>
    : T extends { readonly 'minItems': infer TMin extends number }
      ? BuildAtLeastTupleType<TItem, TMin>
      : T extends { readonly 'maxItems': infer TMax extends number }
        ? BuildAtMostTupleType<TItem, TMax>
        : readonly TItem[];

/**
 * Pairwise-distinctness check across a tuple of literal-typed elements.
 * Returns `never` if any pair of elements has overlapping types (treated as
 * potential duplicates). Capped at 8 elements (quadratic cost). Above the cap,
 * the tuple is returned unchanged — runtime validation still enforces
 * `uniqueItems`.
 */
type UniqueTuplePairwiseType<TTuple, TPrev extends readonly unknown[] = []>
  = TTuple extends readonly [infer THead, ...infer TRest]
    ? TPrev['length'] extends StringLengthCap
      ? TTuple
      : [TPrev[number]] extends [never]
        // Empty accumulated set — no prior elements to compare against; recurse.
        ? UniqueTuplePairwiseType<TRest, [THead]> extends never
          ? never
          : TTuple
        : THead extends TPrev[number]
          ? never
          : TPrev[number] extends THead
            ? never
            : UniqueTuplePairwiseType<TRest, [...TPrev, THead]> extends never
              ? never
              : TTuple
    : TTuple;

/**
 * Apply tuple distinctness narrowing when `uniqueItems: true`. Tuples whose
 * elements are all literals (length ≤ 8) collapse to `never` if any pair shares
 * a type. Tuples with more than 8 elements exceed the pairwise cap — pairwise
 * narrowing is skipped and a `UniqueArrayBrandType<unknown>` brand is
 * applied instead so the compile-time constraint is preserved. Non-tuple arrays
 * pass through unchanged (the brand on `InferArrayBrandsType` already prevents
 * raw arrays from satisfying the type).
 */
type ApplyUniqueItemsTupleNarrowingType<T, TArr>
  = T extends { readonly 'uniqueItems': true }
    ? TArr extends readonly [unknown, ...unknown[]]
      // 9+ elements exceed the pairwise cap — add brand as fallback constraint.
      ? TArr extends readonly [
        unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown,
        ...unknown[]
      ]
        ? TArr & UniqueArrayBrandType<unknown>
        // ≤ 8 elements — apply pairwise distinctness narrowing.
        : UniqueTuplePairwiseType<TArr>
      : TArr
    : TArr;

type InferArrayType<T, TRoot, TReferences>
  = ApplyUniqueItemsTupleNarrowingType<T, InferArrayShapeType<T, TRoot, TReferences>>;

type InferArrayShapeType<T, TRoot, TReferences>
  // prefixItems + items = tuple + rest
  = T extends { readonly 'items': infer I;
    readonly 'prefixItems': readonly [...infer TPrefix];
    readonly 'type': 'array' }
    ? readonly [...{ readonly [K in keyof TPrefix]: InferSchemaType<TPrefix[K], TRoot, TReferences> },
      ...Array<InferSchemaType<I, TRoot, TReferences>>]
    // items + minItems and/or maxItems → tuple narrowing
    : T extends { readonly 'items': infer I;
      readonly 'type': 'array' }
      ? T extends { readonly 'maxItems': number } | { readonly 'minItems': number }
        ? NarrowArrayByItemsBoundsType<InferSchemaType<I, TRoot, TReferences>, T>
        : ReadonlyArray<InferSchemaType<I, TRoot, TReferences>>
      // prefixItems only
      : T extends { readonly 'prefixItems': readonly [...infer TPrefix];
        readonly 'type': 'array' }
        ? readonly [...{ readonly [K in keyof TPrefix]: InferSchemaType<TPrefix[K], TRoot, TReferences> }]
        // contains only (no items) — element type narrows to contains schema
        : T extends { readonly 'contains': infer C;
          readonly 'type': 'array' }
          ? ReadonlyArray<InferSchemaType<C, TRoot, TReferences>>
          // raw minItems / maxItems on a typeless-element array → tuple of unknown
          : T extends { readonly 'type': 'array' }
            ? T extends { readonly 'maxItems': number } | { readonly 'minItems': number }
              ? NarrowArrayByItemsBoundsType<unknown, T>
              : readonly unknown[]
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
    // patternProperties (no declared `properties`). A co-present
    // `additionalProperties` schema is intentionally NOT folded in: it applies
    // only to keys matching NO pattern, and "string keys except `pattern`" is
    // inexpressible in TypeScript — a broad `[k: string]` index would conflict
    // with the template-literal pattern index. The pattern value types are
    // exact (refs resolve); the additionalProperties fallback is an accepted
    // under-approximation, not unsound.
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
      // propertyNames: { pattern } — key type narrowed via PatternToKeyType.
      // Unrecognised patterns resolve PatternToKeyType to `string`, keeping the
      // fallback identical to the open-object catch-all.
        : T extends {
          readonly 'propertyNames': { readonly 'pattern': infer KP extends string };
          readonly 'type': 'object';
        }
          ? InferObjectBrandsType<T>
          & (T extends { readonly 'additionalProperties': infer A }
            ? { readonly [P in PatternToKeyType<KP>]?: InferSchemaType<A, TRoot, TReferences> }
            : { readonly [P in PatternToKeyType<KP>]?: unknown })
        // additionalProperties-only object (no declared properties): the value
        // schema still types the index signature, so a `$ref` here resolves
        // (and a miss brands) rather than collapsing to Record<string, unknown>.
        // Matches only a schema-valued additionalProperties; `false`/`true` fall
        // through to the open-object catch-all unchanged.
          : T extends { readonly 'additionalProperties': Record<string, unknown>;
            readonly 'type': 'object' }
            ? InferAdditionalType<T, TRoot, TReferences> & InferObjectBrandsType<T>
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
      // Not found — `never` is the miss sentinel, branded by the caller. The
      // value is never surfaced raw (`never extends Brand` is vacuously true).
      : never;

/** Search $defs entries for a matching $anchor. Resolves to `never` (the miss
 *  sentinel) when no entry matches. */
type FindAnchorInDefsType<TAnchor extends string, TDefs>
  = TDefs extends Record<string, unknown>
    ? { [K in keyof TDefs]: TDefs[K] extends { readonly '$anchor': TAnchor } ? TDefs[K] : never }[keyof TDefs]
    : never;

/**
 * Find an embedded schema resource by `$id` within a compound document.
 *
 * Searches the root schema's `$defs` for an entry whose `$id` matches `TId`.
 * This is the graph-native resolution path: a self-contained (bundled) schema
 * carries its referenced resources under `$defs`, so a cross-resource `$ref`
 * resolves against the document's own embedded graph with no external
 * references map. Resolves to `never` when no embedded resource matches.
 */
type FindSchemaByIdType<TId extends string, TRoot>
  = TRoot extends { readonly '$defs': infer TDefs }
    ? { [K in keyof TDefs]: TDefs[K] extends { readonly '$id': TId } ? TDefs[K] : never }[keyof TDefs]
    : never;

/**
 * Resolve the schema a `$ref` base IRI denotes against the reference graph
 * reachable at compile time. Resolution order:
 *
 *   1. the root schema itself, when its `$id` equals the base (self-reference);
 *   2. an embedded resource under the root's `$defs` whose `$id` matches — the
 *      graph-native compound-document path, requiring no references map;
 *   3. an entry in the threaded references map (registry-bound resolution).
 *
 * When none match, the base is genuinely unreachable and resolves to
 * `RefNotFoundType<TBase>` — uniformly. The outcome never depends on
 * whether a references map happens to be present: the same unresolved base
 * always yields the same brand, never a silent `unknown`.
 */
type ResolveRefBaseSchemaType<TBase extends string, TRoot, TReferences>
  = TRoot extends { readonly '$id': TBase }
    ? TRoot
    : FindSchemaByIdType<TBase, TRoot> extends infer TEmbedded
      ? [TEmbedded] extends [never]
        ? TBase extends keyof TReferences
          ? TReferences[TBase]
          : RefNotFoundType<TBase>
        : TEmbedded
      : RefNotFoundType<TBase>;

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
      ? TBaseSchema extends RefNotFoundType<string>
        ? TBaseSchema
        : Fragment extends `/$defs/${infer K}`
          ? TBaseSchema extends { readonly '$defs': infer TDefs }
            ? K extends keyof TDefs
              ? TDefs[K]
              : AnchorNotFoundType<Base, Fragment>
            : AnchorNotFoundType<Base, Fragment>
          : Fragment extends `/${infer TPath}`
            // JSON Pointer into a reachable base — a missing segment is
            // AnchorNotFound (the `never` miss sentinel must not leak, since
            // `never extends Brand` is vacuously true downstream).
            ? NavigateSchemaPathType<TBaseSchema, TPath> extends infer TNav
              ? [TNav] extends [never]
                ? AnchorNotFoundType<Base, Fragment>
                : TNav
              : never
            : FindAnchorType<Fragment, TBaseSchema> extends infer TAnchorResult
              ? [TAnchorResult] extends [never]
                ? AnchorNotFoundType<Base, Fragment>
                : TAnchorResult
              : unknown
      : unknown
    : unknown;

/**
 * Navigate a JSON Pointer path segment within a schema.
 * Supports multi-level paths like `properties/name/type`. Resolves to `never`
 * (the miss sentinel) when a segment is absent — branded by the caller, never
 * surfaced raw (a valid schema position is always an object, so `never` is an
 * unambiguous "path not found").
 */
type NavigateSchemaPathType<T, TPath extends string>
  = TPath extends `${infer Head}/${infer Rest}`
    ? Head extends keyof T
      ? NavigateSchemaPathType<T[Head], Rest>
      : never
    : TPath extends keyof T
      ? T[TPath]
      : never;

// ---------------------------------------------------------------------------
// $ref / $defs / $anchor / $dynamicRef / $recursiveRef resolution
// ---------------------------------------------------------------------------

/**
 * Resolve a same-document target (local `$defs` key, named `$anchor`, or JSON
 * Pointer). A `never` input is the navigator / anchor-search miss sentinel and
 * becomes `AnchorNotFoundType<'#', TFragment>` — uniform with cross-schema
 * misses, never a silent `unknown`. A found target is inferred against the root
 * so its own refs resolve.
 */
type ResolveLocalTargetType<TResolved, TFragment extends string, TRoot, TReferences>
  = [TResolved] extends [never]
    ? AnchorNotFoundType<'#', TFragment>
    : InferSchemaType<TResolved, TRoot, TReferences>;

type InferRefType<T, TRoot, TReferences>
  // Local $defs ref: #/$defs/Foo (simple key only, no further path segments)
  = T extends { readonly '$ref': `#/$defs/${infer K}` }
    ? K extends `${string}/${string}`
      // Complex path through $defs — use JSON Pointer navigation. A missing
      // path is AnchorNotFoundType, never a silent unknown.
      ? ResolveLocalTargetType<NavigateSchemaPathType<TRoot, `$defs/${K}`>, `/$defs/${K}`, TRoot, TReferences>
      : TRoot extends { readonly '$defs': infer TDefs }
        ? K extends keyof TDefs
          ? InferSchemaType<TDefs[K], TRoot, TReferences>
          // Local $defs key absent → uniform AnchorNotFound brand.
          : AnchorNotFoundType<'#', `/$defs/${K}`>
        : AnchorNotFoundType<'#', `/$defs/${K}`>
    // Self ref: #
    : T extends { readonly '$ref': '#' }
      ? InferSchemaType<TRoot, TRoot, TReferences>
      // Anchor ref: #anchorName (no slash after #)
      : T extends { readonly '$ref': `#${infer TAnchor}` }
        ? TAnchor extends `/${string}`
          // JSON Pointer path: #/properties/foo — a missing segment is
          // AnchorNotFoundType, never a silent unknown.
          ? ResolveLocalTargetType<NavigateSchemaPathType<TRoot, RemoveLeadingSlashType<TAnchor>>, TAnchor, TRoot, TReferences>
          // Named anchor: #myAnchor — an absent anchor is AnchorNotFoundType.
          : ResolveLocalTargetType<FindAnchorType<TAnchor, TRoot>, TAnchor, TRoot, TReferences>
        // External ref with fragment: someUri#fragment
        : T extends { readonly '$ref': `${infer TBase}#${string}` }
          ? ResolveRefBaseSchemaType<TBase, TRoot, TReferences> extends infer TBaseSchema
            ? SplitFragmentRefType<T['$ref'], TRoot, TReferences> extends infer TResolved
              ? TResolved extends RefNotFoundType<string>
                ? TResolved
                : TResolved extends AnchorNotFoundType<string, string>
                  ? TResolved
                  : InferSchemaType<TResolved, TBaseSchema, TReferences>
              : unknown
            : unknown
          // Absolute/external ref without fragment. Resolution order mirrors
          // the fragment path (ResolveRefBaseSchemaType): threaded references
          // map first (so a referenced schema becomes its own root for deep
          // transitive resolution), then self-reference to the root's own $id,
          // then a resource embedded under the root's $defs by $id (the
          // graph-native compound-document path — resolved against the original
          // root so sibling resources stay reachable). An unreachable base is
          // always RefNotFoundType<TRef> — uniform with the fragment path,
          // never a silent unknown.
          : T extends { readonly '$ref': infer TRef extends string }
            ? TRef extends keyof TReferences
              ? InferSchemaType<TReferences[TRef], TReferences[TRef], TReferences>
              : TRoot extends { readonly '$id': TRef }
                ? InferSchemaType<TRoot, TRoot, TReferences>
                : FindSchemaByIdType<TRef, TRoot> extends infer TEmbedded
                  ? [TEmbedded] extends [never]
                    ? RefNotFoundType<TRef>
                    : InferSchemaType<TEmbedded, TRoot, TReferences>
                  : RefNotFoundType<TRef>
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
    ? FindAnchorType<TAnchor, TRoot> extends infer TFound
      // Not found in the root: $dynamicRef resolves against runtime dynamic
      // scope, which TypeScript cannot model — the honest fallback is `unknown`,
      // NOT a static-miss brand (the anchor may legitimately live in another
      // schema in scope). Distinct from a static `$ref`/`$anchor` miss.
      ? [TFound] extends [never]
        ? unknown
        : InferSchemaType<TFound, TRoot, TReferences>
      : unknown
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
  = U extends 'string' ? InferStringBrandsType<T> & TightStringLengthType<T>
    : U extends 'integer'
      ? [NormalizeMinType<T>] extends [never] ? InferNumberBrandsType<T> & number
        : [NormalizeMaxType<T>] extends [never] ? InferNumberBrandsType<T> & number
          : IsEnabledType<'tightIntegerRanges'> extends true
            ? NormalizeMinType<T> extends infer TMin extends number
              ? NormalizeMaxType<T> extends infer TMax extends number
                ? T extends { readonly 'multipleOf': infer TStep extends number }
                  ? MultipleOfRangeType<TMin, TMax, TStep>
                  : IntegerRangeType<TMin, TMax>
                : InferNumberBrandsType<T> & number
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
 * Narrow a single `if.properties[K]` schema to the value type its presence
 * implies. Returns:
 *   - the literal value `V` for `{ const: V }`
 *   - the union `V` for `{ enum: [V, ...] }`
 *   - the primitive for `{ type: 'string' | 'number' | ... }`
 *   - `never` if the sub-schema doesn't match any recognised form
 *
 * The `never` sentinel is what gates whether the parent if clause qualifies
 * for narrowing. A single `never` on any property means the if clause cannot
 * be narrowed (every property must contribute a constraint).
 */
type IfPropertyNarrowingType<TPropSchema>
  = TPropSchema extends { readonly 'const': infer V } ? V
    : TPropSchema extends { readonly 'enum': ReadonlyArray<infer V> } ? V
      : TPropSchema extends { readonly 'type': infer U extends string }
        ? PrimitiveFromTypeNameType<U>
        : never;

/**
 * Build the narrowing object for an if clause: a `{ readonly [K]: V }` shape
 * to intersect with the then branch. Resolves to `never` (sentinel) when the
 * if clause doesn't qualify — every property in `if.properties` must be in
 * `required` and must produce a non-`never` value type via
 * `IfPropertyNarrowingType`.
 *
 * Single-property const discriminator (e.g. `{ kind: { const: 'circle' } }`)
 * and multi-property conjunctions (e.g. `{ kind: { const: 'a' }, color: { const: 'b' } }`)
 * are both handled uniformly here.
 */
type IfNarrowingObjectType<TIf>
  = TIf extends {
    readonly 'properties': infer P;
    readonly 'required': ReadonlyArray<infer TReq extends string>;
  }
    ? keyof P & string extends TReq
      // Reject if any property resolved to `never` — that property couldn't
      // be narrowed, so the whole conjunction is unsafe. Also reject when
      // there are no properties at all (empty conjunction is meaningless).
      ? { readonly [K in keyof P & string]: IfPropertyNarrowingType<P[K]> } extends infer TNarrow
        ? [TNarrow[keyof TNarrow & string]] extends [never]
          ? never
          : keyof P & string extends never
            ? never
            : TNarrow
        : never
      : never
    : never;

type InferConditionalType<T, TRoot, TReferences>
  = T extends { readonly 'if': infer TIf }
    // Discriminator-narrowed branch: every property in if.properties has a
    // recognised const/enum/type form and is required. Build the narrowing
    // object once and intersect with the then branch.
    ? IfNarrowingObjectType<TIf> extends infer TNarrow extends object
      ? T extends {
        readonly 'else': infer TElse;
        readonly 'then': infer TThen;
      }
        ? InferSchemaType<TElse & WithoutConditionalType<T>, TRoot, TReferences>
          | SimplifyType<InferSchemaType<TThen & WithoutConditionalType<T>, TRoot, TReferences>
            & TNarrow>
        : T extends { readonly 'then': infer TThen }
          ? InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
            | SimplifyType<InferSchemaType<TThen & WithoutConditionalType<T>, TRoot, TReferences>
              & TNarrow>
          : InferSchemaType<WithoutConditionalType<T>, TRoot, TReferences>
      // Fallback: union-of-branches approximation (no usable discriminator detected)
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
// Annotated edge (RDF 1.2 triple-term) inference
// ---------------------------------------------------------------------------

/**
 * Infer the wire type of a `Compose.annotatedEdge` schema.
 *
 * The schema shape is `{ 'jt:annotatedEdge': { predicate, targetRef, annotations } }`.
 * `targetRef` and each annotation `$ref` are resolved against the references map
 * (or root schema) via `InferRefType`, so they surface as their branded class /
 * datatype types rather than `unknown`.
 */
type InferAnnotatedEdgeType<TEdge, TRoot, TReferences>
  = TEdge extends {
    readonly 'annotations': infer TAnnotations;
    readonly 'targetRef': infer TTargetRef extends string;
  }
    ? {
      readonly 'annotations': {
        readonly [K in keyof TAnnotations]: InferSchemaType<TAnnotations[K], TRoot, TReferences>
      };
      readonly 'target': InferRefType<{ readonly '$ref': TTargetRef }, TRoot, TReferences>;
    }
    : unknown;

// ---------------------------------------------------------------------------
// Master dispatcher
// ---------------------------------------------------------------------------

/** Core dispatcher — structural inference without `not` narrowing. */
type InferSchemaTypeCoreType<T, TRoot = T, TReferences = Record<never, never>>
  // Bail out for boolean schemas and broad types
  = [T] extends [boolean] ? unknown
  // Phase 0: Annotated edge (RDF 1.2 triple-term) — distinctive marker key.
    : T extends { readonly 'jt:annotatedEdge': infer TEdge }
      ? InferAnnotatedEdgeType<TEdge, TRoot, TReferences>
    // Phase 1: Transform brands do not change the wire-form schema type.
      : T extends TransformBrandType<unknown>
        ? InferSchemaType<Omit<T, keyof TransformBrandType<unknown>>, TRoot, TReferences>
      // Phase 2: Const/Enum literals
        : T extends { readonly 'const': unknown } ? InferConstType<T>
          : T extends { readonly 'enum': readonly unknown[] } ? InferEnumType<T>
          // Phase 3: $ref / $dynamicRef / $recursiveRef
            : T extends { readonly '$ref': string } ? InferRefType<T, TRoot, TReferences>
              : T extends { readonly '$dynamicRef': string } ? InferDynamicRefType<T, TRoot, TReferences>
                : T extends { readonly '$recursiveRef': string } ? InferRecursiveRefType<T, TRoot, TReferences>
                // Phase 4: Composition
                // When a schema has both `allOf` and `type: 'object'`, intersect
                // the allOf-inferred type with the schema's own object shape. This
                // handles schemas like `{ allOf: [...], type: 'object', properties: {...} }`.
                  : T extends { readonly 'allOf': readonly unknown[];
                    readonly 'type': 'object' }
                    ? InferAllOfType<T, TRoot, TReferences> & InferObjectType<T, TRoot, TReferences>
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
 * @remarks
 * This is the primary public entry point for compile-time type inference.
 * Pass a schema literal (with `as const`) to obtain the TypeScript type that
 * the schema describes. For cross-schema `$ref` resolution, pass the full
 * references map as `TReferences`.
 *
 * @example
 * ```ts
 * const UserSchema = { type: 'object', properties: { name: { type: 'string' } } } as const;
 * type User = InferSchemaType<typeof UserSchema>;  // { name?: string }
 * ```
 *
 * @category Type Inference
 * @since 0.18.0
 * @see {@link NominalSchemaType}
 * @group Type Inference
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type InferSchemaType<T, TRoot = T, TReferences = JsonTologyReferencesInterface>
  = ApplyNotExclusionType<T, InferSchemaTypeCoreType<T, TRoot, TReferences>>;

/**
 * Nominal schema type — adds `$id` and `$schema` phantom brands on top of
 * the structural type inferred by `InferSchemaType`.
 *
 * Schemas with different `$id` values produce incompatible types even when
 * structurally identical. Use this for top-level schemas that need nominal
 * distinction; sub-schemas without `$id` remain structural.
 *
 * @remarks
 * Only active when `nominalBrands` is enabled in the type config (the
 * default). Disable via module augmentation of `JsonTologyTypeConfigInterface`
 * when structural compatibility across schemas is preferred.
 *
 * @example
 * ```ts
 * const UserSchema = { $id: 'https://example.com/User', type: 'object' } as const;
 * type User = NominalSchemaType<typeof UserSchema>;  // branded with SchemaIdBrandType
 * ```
 *
 * @category Type Inference
 * @since 0.18.0
 * @see {@link InferSchemaType}
 * @group Type Inference
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type NominalSchemaType<T, TRoot = T, TReferences = JsonTologyReferencesInterface>
  = InferSchemaType<T, TRoot, TReferences>
    & (IsEnabledType<'nominalBrands'> extends true
      ? (T extends { readonly '$id': infer TId extends string }
        ? SchemaIdBrandType<TId> : unknown)
        & (T extends { readonly '$schema': infer D extends string }
          ? DialectBrandType<D> : unknown)
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
 *
 * Provides IDE autocomplete for `subschemaAt()` pointer arguments by
 * enumerating every reachable JSON Pointer path within the schema.
 *
 * @remarks
 * Recursion is limited to `SchemaPointerDepthCap` levels. Paths deeper than
 * the cap are silently omitted (the runtime `subschemaAt` still accepts them).
 * Covers `$defs`, `allOf`, `anyOf`, `oneOf`, `properties`, `items`,
 * `prefixItems`, `patternProperties`, `additionalProperties`, `contains`,
 * `dependentSchemas`, `not`, `if`, `then`, `else`, and `propertyNames`.
 *
 * @example
 * ```ts
 * const S = { $defs: { User: { type: 'object' } } } as const;
 * type Paths = SchemaPointerPathsType<typeof S>;  // '/$defs/User'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link InferSchemaType}
 * @group Schema Utilities
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
 *
 * @remarks
 * Differs from `InferSchemaType` in that properties listed in `required` or
 * carrying a `default` value are promoted from optional (`?:`) to required.
 * Non-object schemas fall through to plain `InferSchemaType`.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { name: { type: 'string', default: 'anon' }, age: { type: 'number' } },
 *   required: ['age'],
 * } as const;
 * type M = MaterializedSchemaType<typeof S>;  // { name: string; age: number; }
 * ```
 *
 * @category Type Inference
 * @since 0.18.0
 * @see {@link InferSchemaType}
 * @group Type Inference
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type MaterializedSchemaType<T, TRoot = T, TReferences = JsonTologyReferencesInterface>
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

/**
 * Extract top-level property names from a schema.
 *
 * @remarks
 * Returns the union of all keys in the schema's `properties` map as string
 * literals. Schemas without `properties` resolve to `never`.
 *
 * @example
 * ```ts
 * const S = { type: 'object', properties: { id: {}, name: {} } } as const;
 * type Keys = PropertyPathsType<typeof S>;  // 'id' | 'name'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link DeepPropertyPathsType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 */
export type PropertyPathsType<T>
  = T extends { readonly 'properties': infer P }
    ? keyof P & string
    : never;

/**
 * Extract nested property paths (dot-notation) from a schema, depth-limited.
 *
 * @remarks
 * Recursively walks `properties` maps, joining keys with `.` to form paths
 * like `'address.city'`. Recursion stops at `DeepPropertyDepthCap` levels.
 * Paths deeper than the cap are omitted.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { address: { type: 'object', properties: { city: {} } } },
 * } as const;
 * type Paths = DeepPropertyPathsType<typeof S>;  // 'address' | 'address.city'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link PropertyPathsType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TDepth - Internal recursion limiter (do not set manually).
 */
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

/**
 * Extract keys of properties marked `readOnly: true`.
 *
 * @remarks
 * Returns a union of property keys whose schemas carry `readOnly: true`.
 * Used by `InputSchemaType` to strip server-generated fields from API input
 * types. Schemas without `properties` resolve to `never`.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { id: { type: 'string', readOnly: true }, name: { type: 'string' } },
 * } as const;
 * type RO = ReadOnlyKeysType<typeof S>;  // 'id'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link InputSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 */
export type ReadOnlyKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'readOnly': true } ? K : never
    }[keyof P & string]
    : never;

/**
 * Extract keys of properties marked `writeOnly: true`.
 *
 * @remarks
 * Returns a union of property keys whose schemas carry `writeOnly: true`.
 * Used by `OutputSchemaType` to strip client-only fields from API output
 * types. Schemas without `properties` resolve to `never`.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { password: { type: 'string', writeOnly: true }, name: { type: 'string' } },
 * } as const;
 * type WO = WriteOnlyKeysType<typeof S>;  // 'password'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link OutputSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 */
export type WriteOnlyKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'writeOnly': true } ? K : never
    }[keyof P & string]
    : never;

/**
 * Schema type for API input — excludes readOnly properties (server-generated).
 *
 * @remarks
 * Strips all properties marked `readOnly: true` from the inferred type. This
 * is the shape that a client submits when creating or updating a resource.
 * Non-object schemas fall through to plain `InferSchemaType`.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { id: { type: 'string', readOnly: true }, name: { type: 'string' } },
 * } as const;
 * type Input = InputSchemaType<typeof S>;  // { name?: string }
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link OutputSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type InputSchemaType<T, TRoot = T, TReferences = JsonTologyReferencesInterface>
  = T extends { readonly 'properties': unknown;
    readonly 'type': 'object' }
    ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, ReadOnlyKeysType<T>>>
    : InferSchemaType<T, TRoot, TReferences>;

/**
 * Schema type for API output — excludes writeOnly properties (client-only input).
 *
 * @remarks
 * Strips all properties marked `writeOnly: true` from the inferred type. This
 * is the shape that a server returns when reading a resource. Non-object
 * schemas fall through to plain `InferSchemaType`.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { password: { type: 'string', writeOnly: true }, name: { type: 'string' } },
 * } as const;
 * type Output = OutputSchemaType<typeof S>;  // { name?: string }
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link InputSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type OutputSchemaType<T, TRoot = T, TReferences = JsonTologyReferencesInterface>
  = T extends { readonly 'properties': unknown;
    readonly 'type': 'object' }
    ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, WriteOnlyKeysType<T>>>
    : InferSchemaType<T, TRoot, TReferences>;

// ---------------------------------------------------------------------------
// Deprecated property filtering
// ---------------------------------------------------------------------------

/**
 * Extract keys of properties marked `deprecated: true`.
 *
 * @remarks
 * Returns a union of property keys whose schemas carry `deprecated: true`.
 * Used by `NonDeprecatedSchemaType` to strip deprecated fields from the
 * inferred type.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { legacyId: { type: 'string', deprecated: true }, name: { type: 'string' } },
 * } as const;
 * type Dep = DeprecatedKeysType<typeof S>;  // 'legacyId'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link NonDeprecatedSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 */
export type DeprecatedKeysType<T>
  = T extends { readonly 'properties': infer P }
    ? { [K in keyof P & string]: P[K] extends { readonly 'deprecated': true } ? K : never
    }[keyof P & string]
    : never;

/**
 * Schema type excluding deprecated properties.
 *
 * @remarks
 * Strips all properties marked `deprecated: true` from the inferred type.
 * Non-object schemas fall through to plain `InferSchemaType`.
 *
 * @example
 * ```ts
 * const S = {
 *   type: 'object',
 *   properties: { legacyId: { type: 'string', deprecated: true }, name: { type: 'string' } },
 * } as const;
 * type Current = NonDeprecatedSchemaType<typeof S>;  // { name?: string }
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link DeprecatedKeysType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 * @typeParam TRoot - The root schema for $ref resolution (defaults to T).
 * @typeParam TReferences - Map of external schema IRIs to their types.
 */
export type NonDeprecatedSchemaType<T, TRoot = T, TReferences = JsonTologyReferencesInterface>
  = T extends { readonly 'properties': unknown;
    readonly 'type': 'object' }
    ? SimplifyType<Omit<InferSchemaType<T, TRoot, TReferences>, DeprecatedKeysType<T>>>
    : InferSchemaType<T, TRoot, TReferences>;

// ---------------------------------------------------------------------------
// Discriminator property extraction
// ---------------------------------------------------------------------------

/**
 * Extract the discriminator property name from a schema with `discriminator.propertyName`.
 *
 * @remarks
 * Returns the string literal for the `discriminator.propertyName` value, or
 * `never` when the schema does not declare a discriminator. Used to derive
 * narrow union key types at compile time.
 *
 * @example
 * ```ts
 * const S = { discriminator: { propertyName: 'kind' }, oneOf: [] } as const;
 * type D = DiscriminatorPropertyType<typeof S>;  // 'kind'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link InferSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 */
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
  = TAccum['length'] extends TMax
    ? TStarted extends true ? TMax
      : TAccum['length'] extends TMin ? TMax
        : never
    : TAccum['length'] extends IntegerRangeCap ? number
      : TStarted extends true
        ? BuildIntegerRangeType<TMin, TMax, [...TAccum, unknown], true> | TAccum['length']
        : TAccum['length'] extends TMin
          ? BuildIntegerRangeType<TMin, TMax, [...TAccum, unknown], true> | TAccum['length']
          : BuildIntegerRangeType<TMin, TMax, [...TAccum, unknown]>;

/**
 * Test whether `TMax` fits within {@link IntegerRangeCap}. Walks 0,1,2,…
 * counting up: if `TMax` is reached before the cap the range is enumerable
 * (`true`); if the cap is reached first `TMax` is too large (`false`). The
 * walk is bounded by `min(TMax, IntegerRangeCap)` steps, so an out-of-cap
 * `TMax` collapses to `number` without deep instantiation (no TS2589).
 *
 * A plain tuple-length comparison cannot be used here: {@link BuildTupleType}
 * saturates at the cap, making every `TMax >= IntegerRangeCap` indistinguishable
 * from the cap itself and defeating the guard.
 */
type RangeWithinCapType<TMax extends number, T extends unknown[] = []>
  = number extends TMax ? false
    : T['length'] extends TMax ? true
      : T['length'] extends IntegerRangeCap ? false
        : RangeWithinCapType<TMax, [...T, unknown]>;

/**
 * Produce a union of integer literals from Min to Max (inclusive).
 *
 * Only practical for small non-negative ranges (Max ≤ `IntegerRangeCap`).
 * Above the cap, falls back to `number`.
 *
 * @remarks
 * Used internally by `InferSchemaType` when `tightIntegerRanges` is enabled.
 * The cap prevents TypeScript from hitting TS2589 (type instantiation depth)
 * when compiling schemas with large bounded integer ranges.
 *
 * @example
 * ```ts
 * type Rating = IntegerRangeType<1, 5>;  // 1 | 2 | 3 | 4 | 5
 * ```
 *
 * @category Type Inference
 * @since 0.18.0
 * @see {@link MultipleOfRangeType}
 * @group Type Inference
 *
 * @typeParam TMin - Inclusive lower bound (non-negative integer literal).
 * @typeParam TMax - Inclusive upper bound (non-negative integer literal).
 */
export type IntegerRangeType<TMin extends number, TMax extends number>
  = number extends TMin ? number
    : number extends TMax ? number
      : RangeWithinCapType<TMax> extends true
        ? BuildIntegerRangeType<TMin, TMax>
        : number;

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
 * @remarks
 * Used internally by `InferSchemaType` when `tightIntegerRanges` is enabled
 * and the schema declares `multipleOf`. Above `IntegerRangeCap`, falls back
 * to `number` to avoid TS2589.
 *
 * @example
 * ```ts
 * type Evens = MultipleOfRangeType<0, 10, 2>;  // 0 | 2 | 4 | 6 | 8 | 10
 * ```
 *
 * @category Type Inference
 * @since 0.18.0
 * @see {@link IntegerRangeType}
 * @group Type Inference
 *
 * @typeParam TMin - Inclusive lower bound (non-negative integer literal).
 * @typeParam TMax - Inclusive upper bound (non-negative integer literal).
 * @typeParam TStep - The step size (positive integer literal from `multipleOf`).
 */
export type MultipleOfRangeType<
  TMin extends number, TMax extends number, TStep extends number
>
  = number extends TMin ? number
    : number extends TMax ? number
      : number extends TStep ? number
        : RangeWithinCapType<TMax> extends true
          ? BuildMultipleOfRangeType<TMin, TMax, TStep>
          : number;

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

/**
 * Resolves to the schema type T when all defaults match, otherwise never.
 *
 * @remarks
 * Used as a builder parameter constraint to surface default-type mismatches
 * at compile time. When a `default` value does not match the property's
 * declared `type`, the schema resolves to `never`, causing an assignment
 * error at the call site.
 *
 * @example
 * ```ts
 * // Valid — default matches type:
 * const S = { type: 'object', properties: { count: { type: 'number', default: 0 } } } as const;
 * type D = DefaultAlignedType<typeof S>;  // typeof S
 *
 * // Invalid — default mismatches type:
 * const Bad = { type: 'object', properties: { count: { type: 'number', default: 'zero' } } } as const;
 * type E = DefaultAlignedType<typeof Bad>;  // never
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link MaterializedSchemaType}
 * @group Schema Utilities
 *
 * @typeParam T - The full schema object to validate.
 */
export type DefaultAlignedType<T>
  = T extends { readonly 'properties': infer TP }
    ? CheckPropertyDefaultsType<TP> extends true ? T : never
    : T;

// ---------------------------------------------------------------------------
// Enum exhaustiveness
// ---------------------------------------------------------------------------

/**
 * Extract the union of literal values from an enum schema.
 *
 * @remarks
 * Returns the union of every literal in the schema's `enum` array. Schemas
 * without an `enum` keyword resolve to `never`.
 *
 * @example
 * ```ts
 * const S = { enum: ['red', 'green', 'blue'] } as const;
 * type Colors = EnumValuesType<typeof S>;  // 'red' | 'green' | 'blue'
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link ExhaustiveType}
 * @group Schema Utilities
 *
 * @typeParam T - The schema type (should be `as const`).
 */
export type EnumValuesType<T>
  = T extends { readonly 'enum': ReadonlyArray<infer V> } ? V : never;

/**
 * Marker type for exhaustiveness checks — only accepts `never`.
 *
 * @remarks
 * Assign the remainder of a discriminated union to `ExhaustiveType` to get a
 * compile error if any variant is not handled. TypeScript narrows the
 * remaining union to `never` when all cases are covered.
 *
 * @example
 * ```ts
 * type Color = 'red' | 'green' | 'blue';
 * function paint(c: Color): string {
 *   if (c === 'red') return '#f00';
 *   if (c === 'green') return '#0f0';
 *   if (c === 'blue') return '#00f';
 *   const _exhaustive: ExhaustiveType<typeof c> = c;
 *   return _exhaustive;
 * }
 * ```
 *
 * @category Schema Utilities
 * @since 0.18.0
 * @see {@link EnumValuesType}
 * @group Schema Utilities
 *
 * @typeParam T - Must be `never`; a non-never type causes a compile error.
 */
export type ExhaustiveType<T extends never> = T;

// ---------------------------------------------------------------------------
// Brand stripping — structure-preserving
// ---------------------------------------------------------------------------

/**
 * Reconstruct an array/tuple type with each element brand-stripped, dropping any
 * container-level constraint brand (e.g. `minItems`) intersected on the array.
 */
export type UnbrandArrayType<T>
  = T extends readonly [infer THead, ...infer TTail]
    ? readonly [UnbrandType<THead>, ...UnbrandArrayType<TTail>]
    : T extends ReadonlyArray<infer TElem>
      ? ReadonlyArray<UnbrandType<TElem>>
      : readonly [];

/**
 * Strip constraint brands from a schema-inferred type while preserving its
 * structure. Leaf brands collapse to their base primitive
 * (`FormatBrand<'uuid'> & string` → `string`); object/array container brands
 * (`MinItems`, `MinProperties`, …) are dropped; nested shape is preserved.
 *
 * This is the structural canonical form a normalize transform's `decode`
 * produces and `encode` consumes: authors write plain mappers, and `validate`
 * (run by `instantiate`) is the boundary that certifies the branded form. The
 * difference from the (removed) `LooseInputType` is that structure is retained
 * rather than flattened to `Record<string, unknown>`.
 *
 * @typeParam T - The branded type to strip (typically `InferSchemaType<TSchema>`).
 */
export type UnbrandType<T> = T extends unknown
  ? [T] extends [string] ? string
    : [T] extends [number] ? number
      : [T] extends [boolean] ? boolean
        : [T] extends [bigint] ? bigint
          : T extends readonly unknown[] ? UnbrandArrayType<T>
            : T extends object ? { [K in keyof T as K extends symbol ? never : K]: UnbrandType<T[K]> }
              : T
  : never;

/**
 * The brand-free structural canonical form of a schema — the type a normalize
 * transform's `decode` produces and `encode` consumes, and the partial shape
 * `materialize` accepts. Composes the two inference steps so call sites name one
 * intention-revealing type instead of repeating
 * `UnbrandType<InferSchemaType<TSchema, TSchema, TReferences>>`: it resolves the
 * schema (threading `TReferences` for `$ref`s) and strips constraint brands,
 * since `validate` — not the mapper — is the brand boundary.
 *
 * @typeParam TSchema - The schema to resolve.
 * @typeParam TReferences - Cross-schema references map for `$ref` resolution.
 */
export type CanonicalShapeType<TSchema, TReferences = JsonTologyReferencesInterface>
  = UnbrandType<InferSchemaType<TSchema, TSchema, TReferences>>;

export type {
  FindAnchorType,
  NavigateSchemaPathType,
  SplitFragmentRefType
};
