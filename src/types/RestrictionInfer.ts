/**
 * Compile-time enforcement of OWL class axioms and property restrictions.
 *
 * The runtime path (`SchemaRegistry.validate`) catches violations at validation
 * time. This module hoists those checks into the TypeScript type system so a
 * mismatch is a compile error, not a runtime one.
 *
 * Supported surfaces:
 *
 *   • `Compose.disjointWith(other, body)` — adds a phantom brand to the inferred
 *     type so a value that structurally satisfies both is rejected by the type
 *     system. (Asymmetric: brand lives on the side that declares disjointness;
 *     declare on both sides for full symmetric enforcement, or rely on the
 *     runtime check for the other direction.)
 *
 *   • `Compose.complementOf(other, body)` — same brand mechanism, distinct
 *     namespace, so a class can be both disjointWith X and complementOf Y at
 *     once without the brands colliding.
 *
 *   • OWL property restrictions composed via `Compose.subClassOf(restriction,
 *     body)` — `jt:restrictions` is read off the body schema and folded into
 *     the inferred property types:
 *
 *       hasValue(prop, V)        → property type narrowed to the literal V.
 *       cardinality(prop, N)     → property type narrowed to a length-N tuple.
 *       minCardinality(prop, N)  → property type narrowed to a non-empty
 *                                  tuple with N required prefix elements.
 *       maxCardinality(prop, N)  → property type narrowed to a union of tuples
 *                                  with length 0..N.
 *       someValuesFrom(prop, C)  → property's element type union'd with C and
 *                                  shaped as a non-empty tuple.
 *       allValuesFrom(prop, C)   → property's element type narrowed to C.
 *
 * Recursion caps:
 *   • Tuple builders cap at 16 elements. Above that, the inferred type falls
 *     through to the unconstrained array shape; the runtime check still fires.
 *
 * Property IRI parsing:
 *   • `onProperty` IRIs of the form `<schemaId>#<name>` are read as `<name>`
 *     and matched against the body's `properties` map. IRIs without a `#`
 *     fragment fall through (no narrowing) — the runtime check still fires.
 */


// ---------------------------------------------------------------------------
// Disjoint / complement brands
// ---------------------------------------------------------------------------

/**
 * Phantom brand attached to a class declared `disjointWith` another.
 *
 * @remarks
 * Values typed as `DisjointWithBrandType<OtherId>` are structurally
 * incompatible with values typed as `DisjointWithBrandType<OtherId>`
 * carrying the same brand, so assigning a value of the "other" class to the
 * "this" class position is a compile error when the asymmetric brand is
 * checked.
 *
 * @example
 * ```ts
 * type Dog = DisjointWithBrandType<'https://example.com/Cat'> & { name: string };
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link ComplementOfBrandType}
 * @group Restriction Inference
 *
 * @typeParam TOtherId - The `$id` IRI of the class declared disjoint.
 */
export type DisjointWithBrandType<TOtherId extends string> = {
  readonly '~jt:disjointWith': Readonly<Record<TOtherId, 'disjoint'>>;
};

/**
 * Phantom brand attached to a class declared as the OWL `complementOf` another.
 *
 * @remarks
 * Uses a distinct symbol from `DisjointWithBrandType` so a class can carry
 * both brands simultaneously — one for disjointness, one for complement —
 * without the brand keys colliding.
 *
 * @example
 * ```ts
 * type NonDog = ComplementOfBrandType<'https://example.com/Dog'> & { name: string };
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link DisjointWithBrandType}
 * @group Restriction Inference
 *
 * @typeParam TOtherId - The `$id` IRI of the class this class is the complement of.
 */
export type ComplementOfBrandType<TOtherId extends string> = {
  readonly '~jt:complementOf': Readonly<Record<TOtherId, 'complement'>>;
};

// ---------------------------------------------------------------------------
// Property-IRI parsing — turns `<schemaId>#<name>` into the bare property key.
// ---------------------------------------------------------------------------

type PropertyNameFromIriType<TIri extends string>
  = TIri extends `${string}#${infer TFragment}`
    ? TFragment extends `${string}/${infer TLast}` ? TLast : TFragment
    : TIri;

// ---------------------------------------------------------------------------
// Tuple builders — bounded by TupleCap so recursion stays within TS limits.
// ---------------------------------------------------------------------------

declare const _TUPLE_CAP: 16;

/**
 * Maximum tuple length for all compile-time tuple builders in this module.
 *
 * Caps recursion in `BuildExactTupleType`, `BuildAtLeastTupleType`,
 * `BuildAtMostTupleType`, and `BuildBoundedTupleType` to prevent
 * TypeScript from hitting TS2589 (type instantiation depth exceeded).
 *
 * @remarks
 * Cardinality restrictions above this cap fall through to unconstrained
 * array shapes at the type level; the runtime check in `SchemaRegistry`
 * still enforces the exact cardinality.
 *
 * @example
 * ```ts
 * type Cap = TupleCapType;  // 16
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link BuildExactTupleType}
 * @group Restriction Inference
 */
export type TupleCapType = typeof _TUPLE_CAP;

/**
 * Build a readonly tuple of exactly `TN` elements of type `TItem`.
 *
 * Falls through to `readonly TItem[]` when `TN` exceeds {@link TupleCapType}.
 *
 * @remarks
 * Used by `ApplyOneRestrictionType` to enforce exact-cardinality restrictions
 * (`cardinality(prop, N)`) at compile time.
 *
 * @example
 * ```ts
 * type T = BuildExactTupleType<string, 3>;  // readonly [string, string, string]
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link TupleCapType}
 * @group Restriction Inference
 *
 * @typeParam TItem - The element type.
 * @typeParam TN - The required tuple length.
 * @typeParam TAcc - Accumulator (do not set manually).
 */
export type BuildExactTupleType<TItem, TN extends number, TAcc extends readonly TItem[] = readonly []>
  = TAcc['length'] extends TN
    ? TAcc
    : TAcc['length'] extends TupleCapType
      ? readonly TItem[]
      : BuildExactTupleType<TItem, TN, readonly [TItem, ...TAcc]>;

/**
 * Build a readonly tuple with at least `TN` elements of type `TItem`.
 *
 * The inferred type is `readonly [...TN×TItem, ...TItem[]]`. Falls through to
 * `readonly [TItem, ...TItem[]]` (non-empty) when `TN` exceeds {@link TupleCapType}.
 *
 * @remarks
 * Used by `ApplyOneRestrictionType` to enforce `minCardinality(prop, N)` at
 * compile time.
 *
 * @example
 * ```ts
 * type T = BuildAtLeastTupleType<string, 2>;  // readonly [string, string, ...string[]]
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link BuildAtMostTupleType}
 * @group Restriction Inference
 *
 * @typeParam TItem - The element type.
 * @typeParam TN - The minimum required tuple length.
 * @typeParam TAcc - Accumulator (do not set manually).
 */
export type BuildAtLeastTupleType<TItem, TN extends number, TAcc extends readonly TItem[] = readonly []>
  = TAcc['length'] extends TN
    ? readonly [...TAcc, ...TItem[]]
    : TAcc['length'] extends TupleCapType
      ? readonly [TItem, ...TItem[]]
      : BuildAtLeastTupleType<TItem, TN, readonly [TItem, ...TAcc]>;

/**
 * Build a union of readonly tuples with at most `TN` elements of type `TItem`.
 *
 * Produces `readonly [] | readonly [TItem] | ... | readonly [TItem×TN]`.
 * Falls through to `readonly TItem[]` when `TN` exceeds {@link TupleCapType}.
 *
 * @remarks
 * Used by `ApplyOneRestrictionType` to enforce `maxCardinality(prop, N)` at
 * compile time.
 *
 * @example
 * ```ts
 * type T = BuildAtMostTupleType<string, 2>;
 * // readonly [] | readonly [string] | readonly [string, string]
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link BuildAtLeastTupleType}
 * @group Restriction Inference
 *
 * @typeParam TItem - The element type.
 * @typeParam TN - The maximum allowed tuple length.
 * @typeParam TAcc - Accumulator (do not set manually).
 */
export type BuildAtMostTupleType<TItem, TN extends number, TAcc extends readonly TItem[] = readonly []>
  = TAcc['length'] extends TN
    ? TAcc
    : TAcc['length'] extends TupleCapType
      ? readonly TItem[]
      : BuildAtMostTupleType<TItem, TN, readonly [TItem, ...TAcc]> | TAcc;

/**
 * Build a union of readonly tuples whose lengths span `[TMin, TMax]` inclusive.
 *
 * Falls through to `readonly TItem[]` when the cap is reached.
 *
 * @remarks
 * Used by `NarrowArrayByItemsBoundsType` in `Infer.ts` when a schema declares
 * both `minItems` and `maxItems`. The union covers every valid length in the
 * range so TypeScript can enforce the bounds at assignment sites.
 *
 * @example
 * ```ts
 * type T = BuildBoundedTupleType<string, 1, 3>;
 * // readonly [string] | readonly [string, string] | readonly [string, string, string]
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link BuildAtLeastTupleType}
 * @group Restriction Inference
 *
 * @typeParam TItem - The element type.
 * @typeParam TMin - Inclusive lower bound for the tuple length.
 * @typeParam TMax - Inclusive upper bound for the tuple length.
 * @typeParam TAcc - Accumulator (do not set manually).
 */
export type BuildBoundedTupleType<
  TItem,
  TMin extends number,
  TMax extends number,
  TAcc extends readonly TItem[] = readonly []
>
  = TAcc['length'] extends TupleCapType
    ? readonly TItem[]
    : TAcc['length'] extends TMax
      ? TAcc
      : TAcc['length'] extends TMin
        ? BuildBoundedTupleType<TItem, TMin, TMax, readonly [TItem, ...TAcc]> | TAcc
        : BuildBoundedTupleType<TItem, TMin, TMax, readonly [TItem, ...TAcc]>;

// ---------------------------------------------------------------------------
// Restriction descriptor — matches the runtime shape from
// `src/types/Restriction.ts` but expressed in compile-time form.
// ---------------------------------------------------------------------------

type RestrictionShapeType<
  TKind extends string,
  TProperty extends string,
  TValue
> = {
  readonly 'kind': TKind;
  readonly 'onProperty': TProperty;
  readonly 'value': TValue;
};

// ---------------------------------------------------------------------------
// Property element extraction — pulls element type out of an array property.
// ---------------------------------------------------------------------------

type ElementOfArrayType<T> = T extends ReadonlyArray<infer E> ? E : T;

// ---------------------------------------------------------------------------
// Apply a single restriction to the inferred property map.
// ---------------------------------------------------------------------------

type NarrowPropertyType<TProps, TKey extends string, TNarrow>
  = TKey extends keyof TProps
    ? Omit<TProps, TKey> & Readonly<Record<TKey, TNarrow>>
    : TProps;

type ApplyOneRestrictionType<TProps, TRestriction>
  = TRestriction extends RestrictionShapeType<'hasValue', infer TProp extends string, infer TVal>
    ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>, TVal>
    : TRestriction extends RestrictionShapeType<'cardinality', infer TProp extends string, infer TN>
      ? TN extends number
        ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
          BuildExactTupleType<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>, TN>>
        : TProps
      : TRestriction extends RestrictionShapeType<'minCardinality', infer TProp extends string, infer TN>
        ? TN extends number
          ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
            BuildAtLeastTupleType<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>, TN>>
          : TProps
        : TRestriction extends RestrictionShapeType<'maxCardinality', infer TProp extends string, infer TN>
          ? TN extends number
            ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
              BuildAtMostTupleType<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>, TN>>
            : TProps
          : TRestriction extends RestrictionShapeType<'someValuesFrom', infer TProp extends string, string>
            ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
              readonly [
                ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>,
                ...Array<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>>
              ]>
            : TRestriction extends RestrictionShapeType<'allValuesFrom', infer TProp extends string, string>
              ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
                ReadonlyArray<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>>>
              : TProps;

/**
 * Reduce a `jt:restrictions` array against a property map, applying each
 * restriction in turn. Recursion bounded by the array length (in practice ≤ 6).
 *
 * @remarks
 * Each restriction narrows one property type on the accumulated `TProps` map.
 * Restrictions are applied left-to-right so later ones override earlier
 * narrowings for the same property.
 *
 * @example
 * ```ts
 * type Props = { friends: string[] };
 * type R = ApplyRestrictionsType<Props, [{ kind: 'minCardinality'; onProperty: 'friends'; value: 1 }]>;
 * // { friends: readonly [string, ...string[]] }
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link ExtractRestrictionsType}
 * @group Restriction Inference
 *
 * @typeParam TProps - The property map to restrict.
 * @typeParam TRestrictions - The tuple of restriction descriptors to apply.
 */
export type ApplyRestrictionsType<TProps, TRestrictions extends readonly unknown[]>
  = TRestrictions extends readonly [infer THead, ...infer TTail]
    ? ApplyRestrictionsType<ApplyOneRestrictionType<TProps, THead>, TTail>
    : TProps;

// ---------------------------------------------------------------------------
// Convenience: extract a body schema's restrictions array (or empty tuple).
// ---------------------------------------------------------------------------

/**
 * Extract the `jt:restrictions` array from a body schema, or return an empty
 * tuple when the key is absent.
 *
 * @remarks
 * The empty-tuple fallback makes `ApplyRestrictionsType` a no-op for schemas
 * that declare no OWL property restrictions, avoiding extra conditional checks
 * at every call site.
 *
 * @example
 * ```ts
 * type R1 = ExtractRestrictionsType<{ 'jt:restrictions': [{ kind: 'hasValue'; onProperty: 'x'; value: 1 }] }>;
 * // readonly [{ kind: 'hasValue'; onProperty: 'x'; value: 1 }]
 *
 * type R2 = ExtractRestrictionsType<{ type: 'object' }>;
 * // readonly []
 * ```
 *
 * @category Restriction Inference
 * @since 0.18.0
 * @see {@link ApplyRestrictionsType}
 * @group Restriction Inference
 *
 * @typeParam TBody - The body schema object to extract restrictions from.
 */
export type ExtractRestrictionsType<TBody>
  = TBody extends { readonly 'jt:restrictions': infer R extends readonly unknown[] }
    ? R
    : readonly [];

// ---------------------------------------------------------------------------
// Re-export property helpers that consumers of this module need.
// ---------------------------------------------------------------------------


export {
  type ExtractPropertiesType, type ExtractRequiredType
} from './Compose.js';
