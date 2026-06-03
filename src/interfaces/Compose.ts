import type {
  ExtractPropertiesType, ExtractRequiredType
} from '../types/Compose.js';

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
 * @typeParam TTargetRef - Literal IRI string for the target class `$ref`.
 * @typeParam TAnnotations - Record mapping annotation property names to their `$ref` subschemas.
 * @category Compose
 * @since 0.1.0
 * @see {@link https://www.w3.org/TR/rdf12-concepts/#section-triple-terms RDF 1.2 Triple Terms}
 * @group Compose
 */
export interface AnnotatedEdgeSchemaInterface<
  TPredicate extends string,
  TTargetRef extends string,
  TAnnotations extends Record<string, { readonly '$ref': string }>
> {
  readonly '$id'?: string;
  readonly 'jt:annotatedEdge': {
    readonly 'annotations': TAnnotations;
    readonly 'predicate': TPredicate;
    readonly 'targetRef': TTargetRef;
  };
}

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
export interface IntersectionSchemaInterface<
  TSchemas extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'allOf': TSchemas;
}

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
export interface DiscriminatedUnionSchemaInterface<
  TDiscriminator extends string,
  TVariants extends ReadonlyArray<Record<string, unknown>>,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'discriminator': { readonly 'propertyName': TDiscriminator };
  readonly 'oneOf': TVariants;
}

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
 * @see {@link OmitSchemaInterface}
 * @group Compose
 */
export interface PickSchemaInterface<
  TSchema,
  TKeys extends string,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'properties': Pick<ExtractPropertiesType<TSchema>, keyof ExtractPropertiesType<TSchema> & TKeys>;
  readonly 'required': ReadonlyArray<ExtractRequiredType<TSchema> & TKeys>;
  readonly 'type': 'object';
}

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
 * @see {@link PickSchemaInterface}
 * @group Compose
 */
export interface OmitSchemaInterface<
  TSchema,
  TKeys extends string,
  TId extends string
> {
  readonly '$id': TId;
  readonly 'properties': Omit<ExtractPropertiesType<TSchema>, TKeys>;
  readonly 'required': ReadonlyArray<Exclude<ExtractRequiredType<TSchema>, TKeys>>;
  readonly 'type': 'object';
}

type SubClassOfAllOfType<TParent, TBody>
  = TParent extends ReadonlyArray<infer TItem>
    ? readonly [...readonly TItem[], Omit<TBody, '$id'>]
    : TParent extends { readonly '$id': string }
      ? readonly [TParent, Omit<TBody, '$id'>]
      : ReadonlyArray<Record<string, unknown>>;

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
export type SubClassOfSchemaInterface<
  TParent,
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id'> & {
    readonly '$id': TBody['$id'];
    readonly 'allOf': SubClassOfAllOfType<TParent, TBody>;
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
export type DisjointWithSchemaInterface<
  TOther extends { readonly '$id': string },
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id' | 'disjointWith'> & {
    readonly '$id': TBody['$id'];
    readonly 'disjointWith': TOther['$id'];
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
export type ComplementOfSchemaInterface<
  TOther extends { readonly '$id': string },
  TBody extends Record<string, unknown> & { readonly '$id': string }
>
  = Omit<TBody, '$id' | 'not'> & {
    readonly '$id': TBody['$id'];
    readonly 'not': { readonly '$ref': TOther['$id'] };
  };
