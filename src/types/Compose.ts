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
import type { TupleRecursionCapEntity } from '../entities/TupleRecursionCapEntity.js';

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
export type ValidateSubClassOfBodyType<TParent, TBody extends { '$id': string }>
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
 * Walks the variant tuple (capped at `TupleRecursionCapEntity.Type = 10`) and substitutes
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
> = TDepth['length'] extends TupleRecursionCapEntity.Type
  ? TVariants
  : TVariants extends readonly [infer THead, ...infer TTail]
    ? [
      HasConstDiscriminatorType<THead, TProp> extends true
        ? THead
        : DiscriminatorMissingType<TProp, THead>,
      ...ValidateDiscriminatedVariantsType<TTail, TProp, [unknown, ...TDepth]>
    ]
    : TVariants extends readonly []
      ? []
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
  ? Omit<TOptions, '$id'> & { '$id': SelfEquivalentType<TOptions['$id']> }
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
  '$id': TId;
  'properties': ExtractPropertiesType<TSchema> & { [K in keyof TAdditional]: TAdditional[K] };
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
  = Omit<TSchema, '$id' | 'required'> & { '$id': TId };

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
    '$id': TId;
    'required': Array<keyof ExtractPropertiesType<TSchema>>;
  };

/**
 * Schema shape produced by `Compose.annotatedEdge`.
 *
 * Carries the edge predicate IRI, a `$ref` to the target class, and a map of
 * annotation property names to their `$ref`-valued subschemas. The `jt:annotatedEdge`
 * keyword signals to the graph translator and ABox projector that this property
 * is an annotated edge — i.e. a base triple plus one quad per annotation where
 * the subject is a triple term (RDF 1.2 `<< s p o >>`).
 *
 * Literal field types are preserved as the narrowest literal string so that
 * `$ref` resolution, graph keying, and type inference all operate on the concrete
 * IRI rather than widened `string`.
 *
 * @remarks
 * The `jt:annotatedEdge` descriptor is consumed during graph translation: the
 * predicate IRI names the edge, `targetRef` resolves the object class node, and
 * each annotation entry becomes an extra quad whose subject is the reified triple
 * term `<< source predicate target >>`.
 *
 * Not schema-derivable: its entire purpose is to propagate the caller's literal
 * type arguments (`TPredicate`, `TTargetReference`, `TAnnotations`) into the
 * output shape, which a static `as const` schema constant cannot parameterize.
 * Replacing the inline object with a `FromSchema<typeof Schema>` reference would
 * widen every literal field to its base type and defeat the reason this builder
 * return type exists. No interface form is available either — this is plain
 * data (see the project's `type`-is-data-substrate rule), not a behavioral
 * contract.
 *
 * No-fix exception: `@studnicky/type-alias-invariants` flags this alias because its
 * literal type-parameter members (`TPredicate`, `TTargetReference`, `TAnnotations`)
 * classify as non-schema-derivable data — a fundamental limit of the rule's static
 * analysis for type-parameterized builder-return shapes, not a defect here.
 *
 * @example
 * ```ts
 * const edge = Compose.annotatedEdge(
 *   'https://example.com/knows',
 *   'https://example.com/Person',
 *   { since: { '$ref': 'https://example.com/Date' } }
 * );
 * ```
 *
 * @typeParam TPredicate - Literal IRI string for the edge predicate.
 * @typeParam TTargetReference - Literal IRI string for the target class `$ref`.
 * @typeParam TAnnotations - Record mapping annotation property names to their `$ref` subschemas.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/rdf12-concepts/#section-triple-terms RDF 1.2 Triple Terms}
 * @group Compose
 */
export type AnnotatedEdgeSchemaType<
  TPredicate extends string,
  TTargetReference extends string,
  TAnnotations extends Record<string, { '$ref': string }>
>
  = { '$id'?: string }
    & {
      'jt:annotatedEdge': {
        'annotations': TAnnotations;
        'predicate': TPredicate;
        'targetRef': TTargetReference;
      };
    };

/**
 * Schema shape produced by `Compose.intersection` — an `allOf` composition
 * under a named `$id`.
 *
 * @remarks
 * Represents a JSON Schema intersection of multiple member schemas combined
 * via `allOf`. The graph engine validates data against every member in the
 * array; the TBox emits `rdfs:subClassOf` relations for OWL intersection
 * class expressions.
 *
 * Not schema-derivable: `TSchemas` and `TId` are the caller's own literal type
 * arguments, propagated verbatim into `allOf` and `$id`. A static
 * `FromSchema<typeof Schema>` constant cannot parameterize over the member
 * schemas supplied at each `Compose.intersection` call site. No interface form
 * applies either — this is plain data, not a behavioral contract.
 *
 * No-fix exception: `@studnicky/type-alias-invariants` flags this alias because its
 * literal type-parameter members (`TSchemas`, `TId`) classify as non-schema-derivable
 * data — a fundamental limit of the rule's static analysis for type-parameterized
 * builder-return shapes, not a defect here.
 *
 * @example
 * ```ts
 * const Schema = Compose.intersection(
 *   [PersonSchema, EmployeeSchema],
 *   'https://example.com/PersonEmployee'
 * );
 * ```
 *
 * @typeParam TSchemas - Tuple of member schemas combined in the intersection.
 * @typeParam TId - Literal IRI string for the schema `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://json-schema.org/understanding-json-schema/reference/combining#allof JSON Schema allOf}
 * @group Compose
 */
export type IntersectionSchemaType<
  TSchemas extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
>
  = { '$id': TId }
    & { 'allOf': TSchemas };

/**
 * Schema shape produced by `Compose.discriminatedUnion` — a `oneOf` union
 * with a `discriminator` property selector.
 *
 * @remarks
 * The `discriminator.propertyName` field names the property whose value
 * selects the concrete variant at runtime. The graph engine uses this to
 * fast-path variant resolution rather than testing every `oneOf` branch.
 * The TBox emits `owl:unionOf` for the union class.
 *
 * Not schema-derivable: `TDiscriminator`, `TVariants`, and `TId` are the
 * caller's own literal type arguments, propagated verbatim into
 * `discriminator.propertyName`, `oneOf`, and `$id`. A static
 * `FromSchema<typeof Schema>` constant cannot parameterize over the variants
 * supplied at each `Compose.discriminatedUnion` call site. No interface form
 * applies either — this is plain data, not a behavioral contract.
 *
 * No-fix exception: `@studnicky/type-alias-invariants` flags this alias because its
 * literal type-parameter members (`TDiscriminator`, `TVariants`, `TId`) classify as
 * non-schema-derivable data — a fundamental limit of the rule's static analysis for
 * type-parameterized builder-return shapes, not a defect here.
 *
 * @example
 * ```ts
 * const Shape = Compose.discriminatedUnion(
 *   'kind',
 *   [CircleSchema, RectSchema],
 *   'https://example.com/Shape'
 * );
 * ```
 *
 * @typeParam TDiscriminator - Literal property name used as the discriminator key.
 * @typeParam TVariants - Tuple of variant schemas in the union.
 * @typeParam TId - Literal IRI string for the schema `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://json-schema.org/understanding-json-schema/reference/combining#oneOf JSON Schema oneOf}
 * @group Compose
 */
export type DiscriminatedUnionSchemaType<
  TDiscriminator extends string,
  TVariants extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
>
  = { '$id': TId }
    & {
      'discriminator': { 'propertyName': TDiscriminator };
      'oneOf': TVariants;
    };

/**
 * Schema shape produced by `Compose.pick` — a structural subset of a base
 * schema retaining only the named properties.
 *
 * @remarks
 * Mirrors TypeScript's `Pick<T, K>` utility at the schema level. The
 * resulting schema carries only the picked `properties` keys and the
 * intersection of those keys with the base `required` array. The graph
 * engine and TBox treat it as an independent object schema.
 *
 * @example
 * ```ts
 * const IdOnly = Compose.pick(PersonSchema, ['id'], 'https://example.com/PersonId');
 * ```
 *
 * @typeParam TSchema - Source schema from which properties are selected.
 * @typeParam TKeys - Union of property name literals to retain.
 * @typeParam TId - Literal IRI string for the schema `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link OmitSchemaType}
 * @group Compose
 */
export type PickSchemaType<
  TSchema,
  TKeys extends string,
  TId extends string
> = [TSchema] extends [unknown]
  ? {
    '$id': TId;
    'properties': { [K in keyof ExtractPropertiesType<TSchema> & TKeys]: ExtractPropertiesType<TSchema>[K] };
    'required': Array<ExtractRequiredType<TSchema> & TKeys>;
    'type': 'object';
  }
  : never;

/**
 * Schema shape produced by `Compose.omit` — a structural subset of a base
 * schema with the named properties removed.
 *
 * @remarks
 * Mirrors TypeScript's `Omit<T, K>` utility at the schema level. The
 * resulting schema carries the remaining `properties` after excluding the
 * named keys, and the `required` array with those keys removed. The graph
 * engine and TBox treat it as an independent object schema.
 *
 * @example
 * ```ts
 * const NoPassword = Compose.omit(UserSchema, ['password'], 'https://example.com/PublicUser');
 * ```
 *
 * @typeParam TSchema - Source schema from which properties are removed.
 * @typeParam TKeys - Union of property name literals to exclude.
 * @typeParam TId - Literal IRI string for the schema `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link PickSchemaType}
 * @group Compose
 */
export type OmitSchemaType<
  TSchema,
  TKeys extends string,
  TId extends string
> = [TSchema] extends [unknown]
  ? {
    '$id': TId;
    'properties': {
      [K in Exclude<keyof ExtractPropertiesType<TSchema>, TKeys>]: ExtractPropertiesType<TSchema>[K];
    };
    'required': Array<Exclude<ExtractRequiredType<TSchema>, TKeys>>;
    'type': 'object';
  }
  : never;

type SubClassOfAllOfType<TParent, TBody>
  = TParent extends ReadonlyArray<infer TItem>
    ? [...TItem[], Omit<TBody, '$id'>]
    : TParent extends { readonly '$id': string }
      ? [TParent, Omit<TBody, '$id'>]
      : Array<Record<string, unknown>>;

/**
 * Schema shape produced by `Compose.subClassOf` — a named schema that
 * extends a parent class via an `allOf` array.
 *
 * @remarks
 * Appends the child body (minus its `$id`) to the parent schema's `allOf`
 * array, or wraps the parent in a two-element `allOf` when the parent is a
 * plain schema object. The TBox emits `rdfs:subClassOf` from child to parent.
 * Validation inherits all parent constraints before applying the child's own.
 *
 * @example
 * ```ts
 * const BookSchema = Compose.subClassOf(
 *   BibliographicRecord,
 *   { '$id': 'urn:bookstore:Book', type: 'object', properties: { price: { type: 'number' } } }
 * );
 * ```
 *
 * @typeParam TParent - Parent schema or tuple of parent schemas to extend.
 * @typeParam TBody - Child schema body carrying a required `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/owl2-primer/#Class_Hierarchies OWL 2 Subclass Axioms}
 * @group Compose
 */
export type SubClassOfSchemaType<
  TParent,
  TBody extends Record<string, unknown> & { '$id': string }
>
  = Omit<TBody, '$id'> & {
    '$id': TBody['$id'];
    'allOf': SubClassOfAllOfType<TParent, TBody>;
  };

/**
 * Schema shape produced by `Compose.disjointWith` — a named schema that
 * declares `owl:disjointWith` against another class.
 *
 * @remarks
 * Augments the body schema with a `disjointWith` field carrying the other
 * class's `$id` IRI. The TBox emits `owl:disjointWith` between the two
 * class IRIs, ensuring no individual can belong to both classes simultaneously.
 *
 * @example
 * ```ts
 * const PaperBook = Compose.disjointWith(
 *   EbookSchema,
 *   { '$id': 'urn:bookstore:PaperBook', type: 'object' }
 * );
 * ```
 *
 * @typeParam TOther - The other class schema carrying a `$id` IRI.
 * @typeParam TBody - Body schema carrying a required `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/owl2-primer/#Disjoint_Classes OWL 2 Disjoint Classes}
 * @group Compose
 */
export type DisjointWithSchemaType<
  TOther extends { '$id': string },
  TBody extends Record<string, unknown> & { '$id': string }
>
  = Omit<TBody, '$id' | 'disjointWith'> & {
    '$id': TBody['$id'];
    'disjointWith': TOther['$id'];
  };

/**
 * Schema shape produced by `Compose.complementOf` — a named schema that
 * constrains its instances to be the complement of another class.
 *
 * @remarks
 * Augments the body schema with a `not` field that `$ref`s the other class's
 * `$id` IRI. The TBox emits `owl:complementOf` between the two class IRIs.
 * Validation rejects any instance that satisfies the referenced schema.
 *
 * @example
 * ```ts
 * const NonBook = Compose.complementOf(
 *   BookSchema,
 *   { '$id': 'urn:bookstore:NonBook', type: 'object' }
 * );
 * ```
 *
 * @typeParam TOther - The class schema whose complement is declared.
 * @typeParam TBody - Body schema carrying a required `$id`.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/owl2-primer/#Complement_Classes OWL 2 Complement Classes}
 * @group Compose
 */
export type ComplementOfSchemaType<
  TOther extends { '$id': string },
  TBody extends Record<string, unknown> & { '$id': string }
>
  = Omit<TBody, '$id' | 'not'> & {
    '$id': TBody['$id'];
    'not': { '$ref': TOther['$id'] };
  };
