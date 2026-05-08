import type {
  DiscriminatorMissingType,
  IntersectionIdCollisionType,
  SelfEquivalentType,
  SelfSubClassType
} from './TypeErrors.js';

/** Extract the union of required field names from a schema's `required` array. */
export type ExtractRequiredType<T>
  = T extends { readonly 'required': ReadonlyArray<infer R extends string> } ? R : never;

/** Extract the properties map from a schema, or an empty record if absent. */
export type ExtractPropertiesType<T>
  = T extends { readonly 'properties': infer P extends Record<string, unknown> }
    ? P
    : Record<string, never>;

/**
 * For Compose.subClassOf: reject when the body's $id collides with the parent's
 * $id. Parent may be a single schema or a tuple of schemas. Returns the body
 * unmodified on success; on collision returns a `SelfSubClassType` brand
 * incompatible with any real body literal.
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
 * The check uses indexed-access (`TVariant['properties'][TProp]`) rather than
 * structural matching against a `Record<>` shape so that variants with extra
 * properties beyond the discriminator continue to satisfy the test.
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
 * For Compose.discriminatedUnion: every variant must declare `properties[prop]`
 * as a `const` and list `prop` in `required`. Walks the variant tuple (capped
 * at TupleRecursionCap = 10) and substitutes a `DiscriminatorMissingType`
 * brand for any non-conforming variant.
 */
export type ValidateDiscriminatedVariantsType<
  TVariants,
  TProp extends string,
  TDepth extends readonly unknown[] = []
> = TDepth['length'] extends 10
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
 * Returns the options shape with the same fields; on collision the `$id`
 * field is replaced with a `SelfEquivalentType` brand.
 */
export type ValidateEquivalentOptionsType<
  TSource extends { readonly '$id': string },
  TOptions extends { readonly '$id': string }
> = TOptions['$id'] extends TSource['$id']
  ? Omit<TOptions, '$id'> & { readonly '$id': SelfEquivalentType<TOptions['$id']> }
  : TOptions;

/** Extract the union of $ids from a tuple of schemas. */
export type ExtractSchemaIdsType<TSchemas>
  = TSchemas extends ReadonlyArray<{ readonly '$id': infer TId extends string }>
    ? TId
    : never;

/**
 * For Compose.intersection: reject when `newId` collides with one of the input
 * schemas' $ids. Returns `TId` unchanged when sound; on collision returns an
 * `IntersectionIdCollisionType` brand.
 */
export type ValidateIntersectionIdType<TSchemas, TId extends string>
  = TId extends ExtractSchemaIdsType<TSchemas>
    ? IntersectionIdCollisionType<TId>
    : TId;

export type ExtendSchemaType<
  TSchema extends Record<string, unknown>,
  TAdditional extends Record<string, unknown>,
  TId extends string
> = Omit<TSchema, '$id' | 'properties'> & {
  readonly '$id': TId;
  readonly 'properties': ExtractPropertiesType<TSchema> & { readonly [K in keyof TAdditional]: TAdditional[K] };
};

export type PartialSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & { readonly '$id': TId };

export type RequiredSchemaType<TSchema, TId extends string>
  = Omit<TSchema, '$id' | 'required'> & {
    readonly '$id': TId;
    readonly 'required': ReadonlyArray<keyof ExtractPropertiesType<TSchema>>;
  };
