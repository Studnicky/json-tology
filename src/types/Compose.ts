/**
 * Compose type utilities — compile-time guards and schema derivation helpers
 * used by the `Compose` API.
 *
 * These types enforce correctness constraints at the call site (e.g. preventing
 * a subclass from having the same `$id` as its parent) and derive new schema
 * shapes from existing ones (e.g. making all properties required or optional).
 */

import type {
  DiscriminatorMissingType,
  IntersectionIdCollisionType,
  SelfEquivalentType,
  SelfSubClassType
} from './TypeErrors.js';

// ---------------------------------------------------------------------------
// Recursion limits (type-level cap to prevent infinite tuple expansion)
// ---------------------------------------------------------------------------

declare const _TUPLE_RECURSION_CAP: 10;
type TupleRecursionCap = typeof _TUPLE_RECURSION_CAP;

/**
 * Extract the union of required field names from a schema's `required` array.
 *
 * @remarks
 * Used internally by `Compose` helpers to derive the set of property names
 * that a schema marks as required. Returns `never` when the schema has no
 * `required` array, allowing safe use in conditional mapped types.
 *
 * @example
 * ```ts
 * type S = { required: readonly ['id', 'name']; properties: { id: {}; name: {}; age: {} } };
 * type R = ExtractRequiredType<S>; // 'id' | 'name'
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ExtractPropertiesType}
 * @group Compose Utilities
 *
 * @typeParam T - The schema literal to extract required field names from.
 */
export type ExtractRequiredType<T>
  = T extends { readonly 'required': ReadonlyArray<infer R extends string> } ? R : never;

/**
 * Extract the properties map from a schema, or an empty record if absent.
 *
 * @remarks
 * Used internally by `Compose` helpers to obtain the properties object from
 * a schema literal. Returns `Record<string, never>` when the schema has no
 * `properties` key, so downstream mapped types remain well-typed.
 *
 * @example
 * ```ts
 * type S = { properties: { id: { type: 'string' }; age: { type: 'number' } } };
 * type P = ExtractPropertiesType<S>; // { id: { type: 'string' }; age: { type: 'number' } }
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ExtractRequiredType}
 * @group Compose Utilities
 *
 * @typeParam T - The schema literal to extract the properties map from.
 */
export type ExtractPropertiesType<T>
  = T extends { readonly 'properties': infer P extends Record<string, unknown> }
    ? P
    : Record<string, never>;

/**
 * For Compose.subClassOf: reject when the body's `$id` collides with the
 * parent's `$id`.
 *
 * @remarks
 * Parent may be a single schema or a tuple of schemas. Returns the body
 * unmodified on success; on collision returns a `SelfSubClassType` brand
 * that is incompatible with any real body literal, producing a compile-time
 * error at the call site.
 *
 * @example
 * ```ts
 * type Parent = { $id: 'https://example.com/Animal' };
 * type Body = { $id: 'https://example.com/Dog'; properties: {} };
 * type OK = ValidateSubClassOfBodyType<Parent, Body>; // Body
 * type Bad = ValidateSubClassOfBodyType<Parent, { $id: 'https://example.com/Animal'; properties: {} }>;
 * // SelfSubClassType<'https://example.com/Animal'>
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ValidateDiscriminatedVariantsType}
 * @group Compose Utilities
 *
 * @typeParam TParent - The parent schema or tuple of parent schemas.
 * @typeParam TBody - The subclass body schema whose `$id` must not collide.
 */
export type ValidateSubClassOfBodyType<TParent, TBody extends { readonly '$id': string }>
  = TParent extends ReadonlyArray<{ readonly '$id': infer TParentIds extends string }>
    ? TBody['$id'] extends TParentIds
      ? SelfSubClassType<TBody['$id']>
      : TBody
    : TParent extends { readonly '$id': infer TParentId extends string }
      ? TBody['$id'] extends TParentId
        ? SelfSubClassType<TBody['$id']>
        : TBody
      : TBody;

/**
 * Predicate: a single variant declares `properties[prop]` as a `const` value
 * and lists `prop` in its `required` array.
 *
 * @remarks
 * The check uses indexed-access (`TVariant['properties'][TProp]`) rather than
 * structural matching against a `Record<>` shape so that variants with extra
 * properties beyond the discriminator continue to satisfy the test. This is an
 * internal helper consumed only by `ValidateDiscriminatedVariantsType`.
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ValidateDiscriminatedVariantsType}
 * @group Compose Utilities
 *
 * @typeParam TVariant - The variant schema to test.
 * @typeParam TProp - The discriminator property name.
 */
type HasConstDiscriminatorType<TVariant, TProp extends string>
  = TVariant extends {
    readonly 'properties': Record<string, unknown>;
    readonly 'required': readonly string[];
  }
    ? TProp extends keyof TVariant['properties']
      ? TVariant['properties'][TProp] extends { readonly 'const': unknown }
        ? TProp extends TVariant['required'][number]
          ? true
          : false
        : false
      : false
    : false;

/**
 * For Compose.discriminatedUnion: every variant must declare
 * `properties[prop]` as a `const` and list `prop` in `required`.
 *
 * @remarks
 * Walks the variant tuple (capped at `TupleRecursionCap = 10`) and substitutes
 * a `DiscriminatorMissingType` brand for any non-conforming variant, producing
 * a compile-time error at the call site. Recursion is bounded by the
 * `TDepth` accumulator tuple; once its length reaches the cap the remaining
 * variants are returned unchanged to avoid infinite type expansion.
 *
 * @example
 * ```ts
 * type Variants = readonly [
 *   { properties: { kind: { const: 'circle' } }; required: ['kind'] },
 *   { properties: { kind: { const: 'square' } }; required: ['kind'] },
 * ];
 * type OK = ValidateDiscriminatedVariantsType<Variants, 'kind'>; // Variants unchanged
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ValidateSubClassOfBodyType}
 * @group Compose Utilities
 *
 * @typeParam TVariants - The readonly tuple of variant schemas to validate.
 * @typeParam TProp - The discriminator property name every variant must carry.
 * @typeParam TDepth - Accumulator tuple tracking recursion depth (internal).
 */
export type ValidateDiscriminatedVariantsType<
  TVariants,
  TProp extends string,
  TDepth extends readonly unknown[] = []
> = TDepth['length'] extends TupleRecursionCap
  ? TVariants
  : TVariants extends readonly [infer THead, ...infer TTail]
    ? readonly [
      HasConstDiscriminatorType<THead, TProp> extends true
        ? THead
        : DiscriminatorMissingType<TProp, THead>,
      ...ValidateDiscriminatedVariantsType<TTail, TProp, readonly [unknown, ...TDepth]>
    ]
    : TVariants extends readonly []
      ? readonly []
      : TVariants;

/**
 * For Compose.equivalent: reject when `options.$id` matches `source.$id`.
 *
 * @remarks
 * Returns the options shape with the same fields on success. On collision the
 * `$id` field is replaced with a `SelfEquivalentType` brand that is
 * incompatible with any real `$id` string, producing a compile-time error at
 * the call site.
 *
 * @example
 * ```ts
 * type Source = { $id: 'https://example.com/User' };
 * type Opts = { $id: 'https://example.com/UserV2'; title: 'User V2' };
 * type OK = ValidateEquivalentOptionsType<Source, Opts>; // Opts unchanged
 * type Bad = ValidateEquivalentOptionsType<Source, { $id: 'https://example.com/User'; title: 'Same' }>;
 * // { $id: SelfEquivalentType<'https://example.com/User'>; title: 'Same' }
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ValidateIntersectionIdType}
 * @group Compose Utilities
 *
 * @typeParam TSource - The source schema whose `$id` must not be reused.
 * @typeParam TOptions - The options schema being validated.
 */
export type ValidateEquivalentOptionsType<
  TSource extends { readonly '$id': string },
  TOptions extends { readonly '$id': string }
> = TOptions['$id'] extends TSource['$id']
  ? Omit<TOptions, '$id'> & { readonly '$id': SelfEquivalentType<TOptions['$id']> }
  : TOptions;

/**
 * Extract the union of `$id` strings from a tuple of schemas.
 *
 * @remarks
 * Used by `ValidateIntersectionIdType` to collect all input schema identifiers
 * before checking the proposed intersection `$id` for collisions. Returns
 * `never` when the input is not an array of schemas with `$id` fields.
 *
 * @example
 * ```ts
 * type Schemas = readonly [{ $id: 'https://a.com/A' }, { $id: 'https://a.com/B' }];
 * type Ids = ExtractSchemaIdsType<Schemas>; // 'https://a.com/A' | 'https://a.com/B'
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ValidateIntersectionIdType}
 * @group Compose Utilities
 *
 * @typeParam TSchemas - A readonly array of schemas with `$id` fields.
 */
export type ExtractSchemaIdsType<TSchemas>
  = TSchemas extends ReadonlyArray<{ readonly '$id': infer TId extends string }>
    ? TId
    : never;

/**
 * For Compose.intersection: reject when `newId` collides with one of the
 * input schemas' `$id` values.
 *
 * @remarks
 * Returns `TId` unchanged when the proposed `$id` is sound (no collision).
 * On collision returns an `IntersectionIdCollisionType` brand incompatible
 * with a plain string, producing a compile-time error at the call site.
 *
 * @example
 * ```ts
 * type Schemas = readonly [{ $id: 'https://a.com/A' }];
 * type OK = ValidateIntersectionIdType<Schemas, 'https://a.com/AB'>; // 'https://a.com/AB'
 * type Bad = ValidateIntersectionIdType<Schemas, 'https://a.com/A'>; // IntersectionIdCollisionType<...>
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link ExtractSchemaIdsType}
 * @group Compose Utilities
 *
 * @typeParam TSchemas - The tuple of input schemas to check against.
 * @typeParam TId - The proposed `$id` string for the intersection schema.
 */
export type ValidateIntersectionIdType<TSchemas, TId extends string>
  = TId extends ExtractSchemaIdsType<TSchemas>
    ? IntersectionIdCollisionType<TId>
    : TId;

/**
 * Derive an extended schema type by merging additional properties into an
 * existing schema under a new `$id`.
 *
 * @remarks
 * Produces a new schema shape that inherits all keys from `TSchema` (except
 * the original `$id` and `properties`), replaces `$id` with `TId`, and
 * merges `ExtractPropertiesType<TSchema>` with `TAdditional` into the new
 * `properties` map. The result is `readonly` so it can be used as a
 * compile-time schema literal.
 *
 * @example
 * ```ts
 * type Base = { $id: 'https://example.com/A'; properties: { x: {} } };
 * type Extended = ExtendSchemaType<Base, { y: {} }, 'https://example.com/B'>;
 * // { $id: 'https://example.com/B'; properties: { x: {}; y: {} } }
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link PartialSchemaType}
 * @group Compose Utilities
 *
 * @typeParam TSchema - The base schema whose properties are inherited.
 * @typeParam TAdditional - Additional properties merged on top of the base.
 * @typeParam TId - The `$id` string for the resulting extended schema.
 */
export type ExtendSchemaType<
  TSchema extends Record<string, unknown>,
  TAdditional extends Record<string, unknown>,
  TId extends string
> = Omit<TSchema, '$id' | 'properties'> & {
  readonly '$id': TId;
  readonly 'properties': ExtractPropertiesType<TSchema> & { readonly [K in keyof TAdditional]: TAdditional[K] };
};

/**
 * Derive a partial schema type by dropping `required` from an existing schema
 * and assigning a new `$id`.
 *
 * @remarks
 * All other schema keys are preserved. The resulting type makes every property
 * optional at the schema level, mirroring the effect of `Partial<T>` on the
 * inferred TypeScript type.
 *
 * @example
 * ```ts
 * type Full = { $id: 'https://example.com/User'; required: ['id']; properties: { id: {} } };
 * type P = PartialSchemaType<Full, 'https://example.com/PartialUser'>;
 * // { $id: 'https://example.com/PartialUser'; properties: { id: {} } }
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link RequiredSchemaType}
 * @group Compose Utilities
 *
 * @typeParam TSchema - The source schema to make partial.
 * @typeParam TId - The `$id` string for the resulting partial schema.
 */
export type PartialSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & { readonly '$id': TId };

/**
 * Derive a required schema type by replacing `required` with all property
 * keys from the schema and assigning a new `$id`.
 *
 * @remarks
 * Produces a new schema shape where `required` is `ReadonlyArray<keyof P>` and
 * `P` is `ExtractPropertiesType<TSchema>`. All other schema keys are preserved.
 * This mirrors the effect of `Required<T>` on the inferred TypeScript type.
 *
 * @example
 * ```ts
 * type P = { $id: 'https://example.com/PartialUser'; properties: { id: {}; name: {} } };
 * type R = RequiredSchemaType<P, 'https://example.com/User'>;
 * // { $id: 'https://example.com/User'; properties: { id: {}; name: {} }; required: readonly ['id', 'name'] }
 * ```
 *
 * @category Compose Utilities
 * @since 0.10.0
 * @see {@link PartialSchemaType}
 * @group Compose Utilities
 *
 * @typeParam TSchema - The source schema to make fully required.
 * @typeParam TId - The `$id` string for the resulting required schema.
 */
export type RequiredSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & {
    readonly '$id': TId;
    readonly 'required': ReadonlyArray<keyof ExtractPropertiesType<TSchema>>;
  };
