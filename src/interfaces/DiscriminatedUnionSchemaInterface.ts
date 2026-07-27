interface DiscriminatorShapeInterface<TDiscriminator extends string> {
  readonly 'discriminatorShapeBrand'?: unique symbol;
  'propertyName': TDiscriminator;
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
 * `TDiscriminator`/`TVariants`/`TId` are the caller's own literal type
 * arguments, propagated verbatim into `discriminator.propertyName`/`oneOf`/`$id`
 * at each `Compose.discriminatedUnion` call site — a static JSON Schema
 * constant cannot parameterize over them, so this is declared as a generic
 * interface (a behavioral/type-level contract) rather than schema-derived
 * data. Carries a `unique symbol` brand member so it has real contract
 * evidence per `@studnicky/interface-must-be-contract` without disturbing the
 * generic literal narrowing that is the entire point of this type.
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
  '$id': TId;
  readonly 'discriminatedUnionSchemaBrand'?: unique symbol;
  'discriminator': DiscriminatorShapeInterface<TDiscriminator>;
  'oneOf': TVariants;
}
