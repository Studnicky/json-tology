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

/** Phantom brand attached to a class declared `disjointWith` another. */
export interface DisjointWithBrandInterface<TOtherId extends string> {
  readonly '~jt:disjointWith': Readonly<Record<TOtherId, 'disjoint'>>;
}

/** Phantom brand attached to a class declared as the OWL `complementOf` another. */
export interface ComplementOfBrandInterface<TOtherId extends string> {
  readonly '~jt:complementOf': Readonly<Record<TOtherId, 'complement'>>;
}

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

export type TupleCapType = 16;

export type BuildExactTupleType<TItem, TN extends number, TAcc extends readonly TItem[] = []>
  = TAcc['length'] extends TN
    ? TAcc
    : TAcc['length'] extends TupleCapType
      ? readonly TItem[]
      : BuildExactTupleType<TItem, TN, readonly [TItem, ...TAcc]>;

export type BuildAtLeastTupleType<TItem, TN extends number, TAcc extends readonly TItem[] = []>
  = TAcc['length'] extends TN
    ? readonly [...TAcc, ...TItem[]]
    : TAcc['length'] extends TupleCapType
      ? readonly [TItem, ...TItem[]]
      : BuildAtLeastTupleType<TItem, TN, readonly [TItem, ...TAcc]>;

export type BuildAtMostTupleType<TItem, TN extends number, TAcc extends readonly TItem[] = []>
  = TAcc['length'] extends TN
    ? TAcc
    : TAcc['length'] extends TupleCapType
      ? readonly TItem[]
      : BuildAtMostTupleType<TItem, TN, readonly [TItem, ...TAcc]> | TAcc;

/**
 * Build a union of readonly tuples whose lengths span `[TMin, TMax]` inclusive.
 * Falls through to `readonly TItem[]` when the cap is reached.
 */
export type BuildBoundedTupleType<
  TItem,
  TMin extends number,
  TMax extends number,
  TAcc extends readonly TItem[] = []
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

interface RestrictionShape<
  TKind extends string,
  TProperty extends string,
  TValue
> {
  readonly 'kind': TKind;
  readonly 'onProperty': TProperty;
  readonly 'value': TValue;
}

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
  = TRestriction extends RestrictionShape<'hasValue', infer TProp extends string, infer TVal>
    ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>, TVal>
    : TRestriction extends RestrictionShape<'cardinality', infer TProp extends string, infer TN>
      ? TN extends number
        ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
          BuildExactTupleType<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>, TN>>
        : TProps
      : TRestriction extends RestrictionShape<'minCardinality', infer TProp extends string, infer TN>
        ? TN extends number
          ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
            BuildAtLeastTupleType<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>, TN>>
          : TProps
        : TRestriction extends RestrictionShape<'maxCardinality', infer TProp extends string, infer TN>
          ? TN extends number
            ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
              BuildAtMostTupleType<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>, TN>>
            : TProps
          : TRestriction extends RestrictionShape<'someValuesFrom', infer TProp extends string, string>
            ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
              readonly [
                ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>,
                ...Array<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>>
              ]>
            : TRestriction extends RestrictionShape<'allValuesFrom', infer TProp extends string, string>
              ? NarrowPropertyType<TProps, PropertyNameFromIriType<TProp>,
                ReadonlyArray<ElementOfArrayType<TProps[keyof TProps & PropertyNameFromIriType<TProp>]>>>
              : TProps;

/**
 * Reduce a `jt:restrictions` array against a property map, applying each
 * restriction in turn. Recursion bounded by the array length (in practice ≤ 6).
 */
export type ApplyRestrictionsType<TProps, TRestrictions extends readonly unknown[]>
  = TRestrictions extends readonly [infer THead, ...infer TTail]
    ? ApplyRestrictionsType<ApplyOneRestrictionType<TProps, THead>, TTail>
    : TProps;

// ---------------------------------------------------------------------------
// Convenience: extract a body schema's restrictions array (or empty tuple).
// ---------------------------------------------------------------------------

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
