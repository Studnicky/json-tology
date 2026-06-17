/**
 * Constraint Brands
 *
 * Phantom brand interfaces for JSON Schema constraint keywords.
 * Each brand uses a unique symbol so that values constrained differently
 * (e.g. `format: 'email'` vs `format: 'uri'`) produce incompatible types.
 *
 * Branded values can only be obtained through the validation API
 * (`coerce`, `materialize`, `is`). Plain primitives are not assignable
 * to branded types — this is intentional.
 */

declare const CONTAINS: unique symbol;
declare const CONTENT_ENCODING: unique symbol;
declare const CONTENT_MEDIA_TYPE: unique symbol;
declare const DIALECT: unique symbol;
declare const EXCLUSIVE_MAXIMUM: unique symbol;
declare const EXCLUSIVE_MINIMUM: unique symbol;
declare const FORMAT: unique symbol;
declare const MAX_CONTAINS: unique symbol;
declare const MAX_ITEMS: unique symbol;
declare const MAX_LENGTH: unique symbol;
declare const MAX_PROPERTIES: unique symbol;
declare const MAXIMUM: unique symbol;
declare const MIN_CONTAINS: unique symbol;
declare const MIN_ITEMS: unique symbol;
declare const MIN_LENGTH: unique symbol;
declare const MIN_PROPERTIES: unique symbol;
declare const MINIMUM: unique symbol;
declare const MULTIPLE_OF: unique symbol;
declare const PATTERN: unique symbol;
declare const SCHEMA_ID: unique symbol;
declare const UNIQUE_ITEMS: unique symbol;
declare const UNIQUE_ARRAY: unique symbol;

/**
 * Phantom brand for the `contains` keyword.
 *
 * Carries the inferred type of the `contains` sub-schema so callers can
 * distinguish an array validated against one `contains` schema from one
 * validated against a different schema.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 * The brand is not assignable from plain arrays — values must pass through
 * the validation API (`coerce`, `materialize`, or `is`) first.
 *
 * @example
 * ```ts
 * type T = ContainsBrandType<string>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueArrayBrandType}
 * @group Constraint Brands
 *
 * @typeParam T - The inferred type of the `contains` sub-schema.
 */
export type ContainsBrandType<T> = { readonly [CONTAINS]: T };

/**
 * Phantom brand for the `contentEncoding` keyword.
 *
 * Carries the encoding string literal so a `base64`-encoded value cannot be
 * passed where a `base64url`-encoded value is expected.
 *
 * @remarks
 * Attach via `InferSchemaType` when `contentBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = ContentEncodingBrandType<'base64'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ContentMediaTypeBrandType}
 * @group Constraint Brands
 *
 * @typeParam T - The `contentEncoding` string literal (e.g. `'base64'`).
 */
export type ContentEncodingBrandType<T extends string> = { readonly [CONTENT_ENCODING]: T };

/**
 * Phantom brand for the `contentMediaType` keyword.
 *
 * Carries the media-type string literal so a value declared with
 * `contentMediaType: 'application/json'` cannot be confused with
 * `contentMediaType: 'image/png'`.
 *
 * @remarks
 * Attach via `InferSchemaType` when `contentBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = ContentMediaTypeBrandType<'application/json'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ContentEncodingBrandType}
 * @group Constraint Brands
 *
 * @typeParam T - The `contentMediaType` string literal (e.g. `'application/json'`).
 */
export type ContentMediaTypeBrandType<T extends string> = { readonly [CONTENT_MEDIA_TYPE]: T };

/**
 * Phantom brand for the `$schema` dialect keyword.
 *
 * Carries the dialect URI so schemas declared against different meta-schemas
 * produce incompatible types.
 *
 * @remarks
 * Attach via `NominalSchemaType` when `nominalBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = DialectBrandType<'https://json-schema.org/draft/2020-12/schema'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link SchemaIdBrandType}
 * @group Constraint Brands
 *
 * @typeParam T - The dialect URI string literal.
 */
export type DialectBrandType<T extends string> = { readonly [DIALECT]: T };

/**
 * Phantom brand for the `exclusiveMaximum` keyword.
 *
 * Carries the exclusive upper bound so numbers validated against different
 * upper limits produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `numericBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = ExclusiveMaximumBrandType<100>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ExclusiveMinimumBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the exclusive upper bound.
 */
export type ExclusiveMaximumBrandType<TN extends number> = { readonly [EXCLUSIVE_MAXIMUM]: TN };

/**
 * Phantom brand for the `exclusiveMinimum` keyword.
 *
 * Carries the exclusive lower bound so numbers validated against different
 * lower limits produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `numericBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = ExclusiveMinimumBrandType<0>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ExclusiveMaximumBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the exclusive lower bound.
 */
export type ExclusiveMinimumBrandType<TN extends number> = { readonly [EXCLUSIVE_MINIMUM]: TN };

/**
 * Phantom brand for the `format` keyword.
 *
 * Carries the format string literal so a value validated as `'email'` cannot
 * be passed where a `'uri'`-validated value is expected. All per-format named
 * aliases (`EmailBrandType`, `UriBrandType`, etc.) are built on this
 * parametric brand.
 *
 * @remarks
 * Attach via `InferSchemaType` when `formatBrands` is enabled.
 * The intersection with `string` (or `number`) preserves assignability to the
 * base primitive while adding the format constraint.
 *
 * @example
 * ```ts
 * type T = FormatBrandType<'email'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link EmailBrandType}
 * @group Constraint Brands
 *
 * @typeParam TF - The format string literal (e.g. `'email'`, `'uuid'`).
 */
export type FormatBrandType<TF extends string> = { readonly [FORMAT]: TF };

/**
 * Phantom brand for the `maxContains` keyword.
 *
 * Carries the maximum number of matching `contains` items so arrays validated
 * against different `maxContains` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 * The brand is not assignable from plain arrays — values must pass through
 * the validation API (`coerce`, `materialize`, or `is`) first.
 *
 * @example
 * ```ts
 * type T = MaxContainsBrandType<5>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.23.0
 * @see {@link MinContainsBrandType}
 * @see {@link ContainsBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum contains count.
 */
export type MaxContainsBrandType<TN extends number> = { readonly [MAX_CONTAINS]: TN };

/**
 * Phantom brand for the `maxItems` keyword.
 *
 * Carries the maximum item count so arrays validated against different
 * `maxItems` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MaxItemsBrandType<10>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinItemsBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum item count.
 */
export type MaxItemsBrandType<TN extends number> = { readonly [MAX_ITEMS]: TN };

/**
 * Phantom brand for the `maxLength` keyword.
 *
 * Carries the maximum string length so strings validated against different
 * `maxLength` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `stringBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MaxLengthBrandType<255>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinLengthBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum string length.
 */
export type MaxLengthBrandType<TN extends number> = { readonly [MAX_LENGTH]: TN };

/**
 * Phantom brand for the `maxProperties` keyword.
 *
 * Carries the maximum property count so objects validated against different
 * `maxProperties` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `objectBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MaxPropertiesBrandType<20>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinPropertiesBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum property count.
 */
export type MaxPropertiesBrandType<TN extends number> = { readonly [MAX_PROPERTIES]: TN };

/**
 * Phantom brand for the `maximum` keyword.
 *
 * Carries the inclusive upper bound so numbers validated against different
 * `maximum` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `numericBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MaximumBrandType<100>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinimumBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the inclusive upper bound.
 */
export type MaximumBrandType<TN extends number> = { readonly [MAXIMUM]: TN };

/**
 * Phantom brand for the `minContains` keyword.
 *
 * Carries the minimum number of matching `contains` items so arrays validated
 * against different `minContains` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 * The brand is not assignable from plain arrays — values must pass through
 * the validation API (`coerce`, `materialize`, or `is`) first.
 *
 * @example
 * ```ts
 * type T = MinContainsBrandType<2>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.23.0
 * @see {@link MaxContainsBrandType}
 * @see {@link ContainsBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum contains count.
 */
export type MinContainsBrandType<TN extends number> = { readonly [MIN_CONTAINS]: TN };

/**
 * Phantom brand for the `minItems` keyword.
 *
 * Carries the minimum item count so arrays validated against different
 * `minItems` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MinItemsBrandType<1>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaxItemsBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum item count.
 */
export type MinItemsBrandType<TN extends number> = { readonly [MIN_ITEMS]: TN };

/**
 * Phantom brand for the `minLength` keyword.
 *
 * Carries the minimum string length so strings validated against different
 * `minLength` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `stringBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MinLengthBrandType<1>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaxLengthBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum string length.
 */
export type MinLengthBrandType<TN extends number> = { readonly [MIN_LENGTH]: TN };

/**
 * Phantom brand for the `minProperties` keyword.
 *
 * Carries the minimum property count so objects validated against different
 * `minProperties` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `objectBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MinPropertiesBrandType<1>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaxPropertiesBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum property count.
 */
export type MinPropertiesBrandType<TN extends number> = { readonly [MIN_PROPERTIES]: TN };

/**
 * Phantom brand for the `minimum` keyword.
 *
 * Carries the inclusive lower bound so numbers validated against different
 * `minimum` values produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `numericBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MinimumBrandType<0>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaximumBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the inclusive lower bound.
 */
export type MinimumBrandType<TN extends number> = { readonly [MINIMUM]: TN };

/**
 * Phantom brand for the `multipleOf` keyword.
 *
 * Carries the divisor so numbers validated with one step size are incompatible
 * with those validated with a different step size.
 *
 * @remarks
 * Attach via `InferSchemaType` when `numericBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = MultipleOfBrandType<5>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinimumBrandType}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the divisor.
 */
export type MultipleOfBrandType<TN extends number> = { readonly [MULTIPLE_OF]: TN };

/**
 * Phantom brand for the `pattern` keyword.
 *
 * Carries the regex pattern literal so strings validated against different
 * patterns produce incompatible types.
 *
 * @remarks
 * Attach via `InferSchemaType` when `stringBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = PatternBrandType<'^[a-z]+$'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FormatBrandType}
 * @group Constraint Brands
 *
 * @typeParam TP - The regex pattern string literal.
 */
export type PatternBrandType<TP extends string> = { readonly [PATTERN]: TP };

/**
 * Phantom brand for the `$id` keyword.
 *
 * Carries the schema IRI so schemas with different `$id` values produce
 * nominally incompatible types even when structurally identical.
 *
 * @remarks
 * Attach via `NominalSchemaType` when `nominalBrands` is enabled.
 *
 * @example
 * ```ts
 * type T = SchemaIdBrandType<'https://example.com/User'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DialectBrandType}
 * @group Constraint Brands
 *
 * @typeParam TId - The `$id` IRI string literal.
 */
export type SchemaIdBrandType<TId extends string> = { readonly [SCHEMA_ID]: TId };

/**
 * Phantom brand for the `uniqueItems: true` keyword.
 *
 * Marks an array as having been validated for element distinctness.
 * Plain arrays are not assignable to this brand without passing through
 * the validation API.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 * See {@link UniqueArrayBrandType} for the parameterised variant.
 *
 * @example
 * ```ts
 * type T = UniqueItemsBrandType;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueArrayBrandType}
 * @group Constraint Brands
 */
export type UniqueItemsBrandType = { readonly [UNIQUE_ITEMS]: true };

/**
 * Generic uniqueness brand parameterised by element type. Lets downstream APIs
 * assume distinctness post-validation. Produced by `JsonTology.instantiate`
 * and `JsonTology.materialize` when the source schema declares
 * `uniqueItems: true`. Plain arrays cannot satisfy this brand without going
 * through the validation API.
 *
 * @remarks
 * Extends {@link UniqueItemsBrandType} and adds the element-type
 * parameter so APIs that require `ReadonlyArray<T>` can additionally require
 * that the array was validated for uniqueness.
 *
 * @example
 * ```ts
 * type T = UniqueArrayBrandType<string>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueItemsBrandType}
 * @group Constraint Brands
 *
 * @typeParam T - The element type of the unique array.
 */
export type UniqueArrayBrandType<T> = UniqueItemsBrandType & {
  readonly [UNIQUE_ARRAY]: T;
};

/**
 * Per-format named brand aliases.
 *
 * `FormatBrandType<F>` is the underlying parametric brand. Each named
 * alias below specialises it to a single format string so consumer APIs can
 * write `function send(to: EmailBrandType): void` and reject plain
 * `string` arguments at compile time.
 *
 * A value carrying these brands is only obtainable via the validation API
 * (`JsonTology.instantiate`, `JsonTology.materialize`,
 * `JsonTology.is`). Plain string literals are not assignable.
 *
 * The full set of standard JSON Schema 2020-12 string formats is covered:
 * `email`, `idn-email`, `uri`, `uri-reference`, `uri-template`, `iri`,
 * `iri-reference`, `uuid`, `date`, `date-time`, `time`, `duration`,
 * `hostname`, `idn-hostname`, `ipv4`, `ipv6`, `regex`, `json-pointer`,
 * `relative-json-pointer`. Number formats `int32`, `int64`, `float`,
 * `double` plus the OpenAPI-flavoured string formats `binary`, `byte`
 * round out the json-tology built-in registry.
 *
 * Ordering note: `FormatBrandType<F> & string` (not `string & ...`) so
 * IDE hovers display the named brand first instead of `string`.
 */

/**
 * Brand alias for strings validated as `format: 'email'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'email'>` so API signatures can express
 * "must be a validated email address" without accepting any plain string.
 *
 * @example
 * ```ts
 * function send(to: EmailBrandType): void { /* ... *\/ }
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FormatBrandType}
 * @group Constraint Brands
 */
export type EmailBrandType = FormatBrandType<'email'> & string;

/**
 * Brand alias for strings validated as `format: 'idn-email'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'idn-email'>` for internationalised
 * email addresses (RFC 6531).
 *
 * @example
 * ```ts
 * const addr: IdnEmailBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link EmailBrandType}
 * @group Constraint Brands
 */
export type IdnEmailBrandType = FormatBrandType<'idn-email'> & string;

/**
 * Brand alias for strings validated as `format: 'uri'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'uri'>` so URI-typed fields cannot accept
 * arbitrary strings without validation.
 *
 * @example
 * ```ts
 * const href: UriBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriReferenceBrandType}
 * @group Constraint Brands
 */
export type UriBrandType = FormatBrandType<'uri'> & string;

/**
 * Brand alias for strings validated as `format: 'uri-reference'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'uri-reference'>` for relative or
 * absolute URI references (RFC 3986).
 *
 * @example
 * ```ts
 * const ref: UriReferenceBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriBrandType}
 * @group Constraint Brands
 */
export type UriReferenceBrandType = FormatBrandType<'uri-reference'> & string;

/**
 * Brand alias for strings validated as `format: 'uri-template'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'uri-template'>` for RFC 6570 URI templates.
 *
 * @example
 * ```ts
 * const tmpl: UriTemplateBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriBrandType}
 * @group Constraint Brands
 */
export type UriTemplateBrandType = FormatBrandType<'uri-template'> & string;

/**
 * Brand alias for strings validated as `format: 'iri'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'iri'>` for internationalised resource
 * identifiers (RFC 3987).
 *
 * @example
 * ```ts
 * const iri: IriBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriBrandType}
 * @group Constraint Brands
 */
export type IriBrandType = FormatBrandType<'iri'> & string;

/**
 * Brand alias for strings validated as `format: 'iri-reference'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'iri-reference'>` for relative or
 * absolute IRI references (RFC 3987).
 *
 * @example
 * ```ts
 * const ref: IriReferenceBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link IriBrandType}
 * @group Constraint Brands
 */
export type IriReferenceBrandType = FormatBrandType<'iri-reference'> & string;

/**
 * Brand alias for strings validated as `format: 'uuid'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'uuid'>` so UUID-typed fields reject
 * arbitrary strings at compile time.
 *
 * @example
 * ```ts
 * const id: UuidBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FormatBrandType}
 * @group Constraint Brands
 */
export type UuidBrandType = FormatBrandType<'uuid'> & string;

/**
 * Brand alias for strings validated as `format: 'date'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'date'>` for ISO 8601 full-date strings
 * (e.g. `'2024-01-15'`).
 *
 * @example
 * ```ts
 * const d: DateBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateTimeBrandType}
 * @group Constraint Brands
 */
export type DateBrandType = FormatBrandType<'date'> & string;

/**
 * Brand alias for strings validated as `format: 'date-time'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'date-time'>` for ISO 8601 date-time
 * strings including timezone offset.
 *
 * @example
 * ```ts
 * const ts: DateTimeBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateBrandType}
 * @group Constraint Brands
 */
export type DateTimeBrandType = FormatBrandType<'date-time'> & string;

/**
 * Brand alias for strings validated as `format: 'time'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'time'>` for ISO 8601 full-time strings
 * (e.g. `'14:30:00Z'`).
 *
 * @example
 * ```ts
 * const t: TimeBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateTimeBrandType}
 * @group Constraint Brands
 */
export type TimeBrandType = FormatBrandType<'time'> & string;

/**
 * Brand alias for strings validated as `format: 'duration'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'duration'>` for ISO 8601 duration
 * strings (e.g. `'P1Y2M3DT4H5M6S'`).
 *
 * @example
 * ```ts
 * const dur: DurationBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateTimeBrandType}
 * @group Constraint Brands
 */
export type DurationBrandType = FormatBrandType<'duration'> & string;

/**
 * Brand alias for strings validated as `format: 'hostname'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'hostname'>` for RFC 1123 internet host
 * names.
 *
 * @example
 * ```ts
 * const host: HostnameBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link IdnHostnameBrandType}
 * @group Constraint Brands
 */
export type HostnameBrandType = FormatBrandType<'hostname'> & string;

/**
 * Brand alias for strings validated as `format: 'idn-hostname'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'idn-hostname'>` for internationalised
 * host names (RFC 5891).
 *
 * @example
 * ```ts
 * const host: IdnHostnameBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link HostnameBrandType}
 * @group Constraint Brands
 */
export type IdnHostnameBrandType = FormatBrandType<'idn-hostname'> & string;

/**
 * Brand alias for strings validated as `format: 'ipv4'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'ipv4'>` for dotted-decimal IPv4 addresses
 * (e.g. `'192.168.1.1'`).
 *
 * @example
 * ```ts
 * const addr: Ipv4BrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Ipv6BrandType}
 * @group Constraint Brands
 */
export type Ipv4BrandType = FormatBrandType<'ipv4'> & string;

/**
 * Brand alias for strings validated as `format: 'ipv6'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'ipv6'>` for IPv6 addresses in colon-hex
 * notation.
 *
 * @example
 * ```ts
 * const addr: Ipv6BrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Ipv4BrandType}
 * @group Constraint Brands
 */
export type Ipv6BrandType = FormatBrandType<'ipv6'> & string;

/**
 * Brand alias for strings validated as `format: 'regex'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'regex'>` for ECMA 262 regular expression
 * strings.
 *
 * @example
 * ```ts
 * const re: RegexBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link PatternBrandType}
 * @group Constraint Brands
 */
export type RegexBrandType = FormatBrandType<'regex'> & string;

/**
 * Brand alias for strings validated as `format: 'json-pointer'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'json-pointer'>` for RFC 6901 JSON
 * Pointer strings (e.g. `'/foo/bar'`).
 *
 * @example
 * ```ts
 * const ptr: JsonPointerBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link RelativeJsonPointerBrandType}
 * @group Constraint Brands
 */
export type JsonPointerBrandType = FormatBrandType<'json-pointer'> & string;

/**
 * Brand alias for strings validated as `format: 'relative-json-pointer'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'relative-json-pointer'>` for relative
 * JSON Pointer strings as defined in the JSON Schema draft specification.
 *
 * @example
 * ```ts
 * const rel: RelativeJsonPointerBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link JsonPointerBrandType}
 * @group Constraint Brands
 */
export type RelativeJsonPointerBrandType = FormatBrandType<'relative-json-pointer'> & string;

/**
 * Brand alias for strings validated as `format: 'binary'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'binary'>` for OpenAPI-flavoured binary
 * string fields (raw bytes transferred as a string).
 *
 * @example
 * ```ts
 * const bin: BinaryBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ByteBrandType}
 * @group Constraint Brands
 */
export type BinaryBrandType = FormatBrandType<'binary'> & string;

/**
 * Brand alias for strings validated as `format: 'byte'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'byte'>` for base64-encoded byte strings
 * (OpenAPI `byte` format).
 *
 * @example
 * ```ts
 * const b: ByteBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link BinaryBrandType}
 * @group Constraint Brands
 */
export type ByteBrandType = FormatBrandType<'byte'> & string;

/**
 * Brand alias for numbers validated as `format: 'int32'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'int32'>` for 32-bit signed integers.
 * Intersected with `number` rather than `string`.
 *
 * @example
 * ```ts
 * const n: Int32BrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Int64BrandType}
 * @group Constraint Brands
 */
export type Int32BrandType = FormatBrandType<'int32'> & number;

/**
 * Brand alias for numbers validated as `format: 'int64'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'int64'>` for 64-bit signed integers.
 * Intersected with `number` rather than `string`.
 *
 * @example
 * ```ts
 * const n: Int64BrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Int32BrandType}
 * @group Constraint Brands
 */
export type Int64BrandType = FormatBrandType<'int64'> & number;

/**
 * Brand alias for numbers validated as `format: 'float'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'float'>` for single-precision floating
 * point numbers (OpenAPI `float` format). Intersected with `number`.
 *
 * @example
 * ```ts
 * const n: FloatBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DoubleBrandType}
 * @group Constraint Brands
 */
export type FloatBrandType = FormatBrandType<'float'> & number;

/**
 * Brand alias for numbers validated as `format: 'double'`.
 *
 * @remarks
 * Specialises `FormatBrandType<'double'>` for double-precision floating
 * point numbers (OpenAPI `double` format). Intersected with `number`.
 *
 * @example
 * ```ts
 * const n: DoubleBrandType = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FloatBrandType}
 * @group Constraint Brands
 */
export type DoubleBrandType = FormatBrandType<'double'> & number;
