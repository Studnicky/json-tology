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
declare const MAX_ITEMS: unique symbol;
declare const MAX_LENGTH: unique symbol;
declare const MAX_PROPERTIES: unique symbol;
declare const MAXIMUM: unique symbol;
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
 * type T = ContainsBrandInterface<string>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueArrayBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam T - The inferred type of the `contains` sub-schema.
 */
export interface ContainsBrandInterface<T> { readonly [CONTAINS]: T }

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
 * type T = ContentEncodingBrandInterface<'base64'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ContentMediaTypeBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam T - The `contentEncoding` string literal (e.g. `'base64'`).
 */
export interface ContentEncodingBrandInterface<T extends string> { readonly [CONTENT_ENCODING]: T }

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
 * type T = ContentMediaTypeBrandInterface<'application/json'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ContentEncodingBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam T - The `contentMediaType` string literal (e.g. `'application/json'`).
 */
export interface ContentMediaTypeBrandInterface<T extends string> { readonly [CONTENT_MEDIA_TYPE]: T }

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
 * type T = DialectBrandInterface<'https://json-schema.org/draft/2020-12/schema'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link SchemaIdBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam T - The dialect URI string literal.
 */
export interface DialectBrandInterface<T extends string> { readonly [DIALECT]: T }

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
 * type T = ExclusiveMaximumBrandInterface<100>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ExclusiveMinimumBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the exclusive upper bound.
 */
export interface ExclusiveMaximumBrandInterface<TN extends number> { readonly [EXCLUSIVE_MAXIMUM]: TN }

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
 * type T = ExclusiveMinimumBrandInterface<0>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ExclusiveMaximumBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the exclusive lower bound.
 */
export interface ExclusiveMinimumBrandInterface<TN extends number> { readonly [EXCLUSIVE_MINIMUM]: TN }

/**
 * Phantom brand for the `format` keyword.
 *
 * Carries the format string literal so a value validated as `'email'` cannot
 * be passed where a `'uri'`-validated value is expected. All per-format named
 * aliases (`EmailBrandInterface`, `UriBrandInterface`, etc.) are built on this
 * parametric brand.
 *
 * @remarks
 * Attach via `InferSchemaType` when `formatBrands` is enabled.
 * The intersection with `string` (or `number`) preserves assignability to the
 * base primitive while adding the format constraint.
 *
 * @example
 * ```ts
 * type T = FormatBrandInterface<'email'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link EmailBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TF - The format string literal (e.g. `'email'`, `'uuid'`).
 */
export interface FormatBrandInterface<TF extends string> { readonly [FORMAT]: TF }

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
 * type T = MaxItemsBrandInterface<10>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinItemsBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum item count.
 */
export interface MaxItemsBrandInterface<TN extends number> { readonly [MAX_ITEMS]: TN }

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
 * type T = MaxLengthBrandInterface<255>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinLengthBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum string length.
 */
export interface MaxLengthBrandInterface<TN extends number> { readonly [MAX_LENGTH]: TN }

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
 * type T = MaxPropertiesBrandInterface<20>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinPropertiesBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the maximum property count.
 */
export interface MaxPropertiesBrandInterface<TN extends number> { readonly [MAX_PROPERTIES]: TN }

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
 * type T = MaximumBrandInterface<100>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinimumBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the inclusive upper bound.
 */
export interface MaximumBrandInterface<TN extends number> { readonly [MAXIMUM]: TN }

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
 * type T = MinItemsBrandInterface<1>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaxItemsBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum item count.
 */
export interface MinItemsBrandInterface<TN extends number> { readonly [MIN_ITEMS]: TN }

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
 * type T = MinLengthBrandInterface<1>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaxLengthBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum string length.
 */
export interface MinLengthBrandInterface<TN extends number> { readonly [MIN_LENGTH]: TN }

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
 * type T = MinPropertiesBrandInterface<1>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaxPropertiesBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the minimum property count.
 */
export interface MinPropertiesBrandInterface<TN extends number> { readonly [MIN_PROPERTIES]: TN }

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
 * type T = MinimumBrandInterface<0>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MaximumBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the inclusive lower bound.
 */
export interface MinimumBrandInterface<TN extends number> { readonly [MINIMUM]: TN }

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
 * type T = MultipleOfBrandInterface<5>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link MinimumBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TN - The numeric literal for the divisor.
 */
export interface MultipleOfBrandInterface<TN extends number> { readonly [MULTIPLE_OF]: TN }

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
 * type T = PatternBrandInterface<'^[a-z]+$'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FormatBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TP - The regex pattern string literal.
 */
export interface PatternBrandInterface<TP extends string> { readonly [PATTERN]: TP }

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
 * type T = SchemaIdBrandInterface<'https://example.com/User'>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DialectBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam TId - The `$id` IRI string literal.
 */
export interface SchemaIdBrandInterface<TId extends string> { readonly [SCHEMA_ID]: TId }

/**
 * Phantom brand for the `uniqueItems: true` keyword.
 *
 * Marks an array as having been validated for element distinctness.
 * Plain arrays are not assignable to this brand without passing through
 * the validation API.
 *
 * @remarks
 * Attach via `InferSchemaType` when `arrayBrands` is enabled.
 * See {@link UniqueArrayBrandInterface} for the parameterised variant.
 *
 * @example
 * ```ts
 * type T = UniqueItemsBrandInterface;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueArrayBrandInterface}
 * @group Constraint Brands
 */
export interface UniqueItemsBrandInterface { readonly [UNIQUE_ITEMS]: true }

/**
 * Generic uniqueness brand parameterised by element type. Lets downstream APIs
 * assume distinctness post-validation. Produced by `JsonTology.instantiate`
 * and `JsonTology.materialize` when the source schema declares
 * `uniqueItems: true`. Plain arrays cannot satisfy this brand without going
 * through the validation API.
 *
 * @remarks
 * Extends {@link UniqueItemsBrandInterface} and adds the element-type
 * parameter so APIs that require `ReadonlyArray<T>` can additionally require
 * that the array was validated for uniqueness.
 *
 * @example
 * ```ts
 * type T = UniqueArrayBrandInterface<string>;
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UniqueItemsBrandInterface}
 * @group Constraint Brands
 *
 * @typeParam T - The element type of the unique array.
 */
export interface UniqueArrayBrandInterface<T> extends UniqueItemsBrandInterface {
  readonly [UNIQUE_ARRAY]: T;
}

/**
 * Per-format named brand aliases.
 *
 * `FormatBrandInterface<F>` is the underlying parametric brand. Each named
 * alias below specialises it to a single format string so consumer APIs can
 * write `function send(to: EmailBrandInterface): void` and reject plain
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
 * Ordering note: `FormatBrandInterface<F> & string` (not `string & ...`) so
 * IDE hovers display the named brand first instead of `string`.
 */

/**
 * Brand alias for strings validated as `format: 'email'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'email'>` so API signatures can express
 * "must be a validated email address" without accepting any plain string.
 *
 * @example
 * ```ts
 * function send(to: EmailBrandInterface): void { /* ... *\/ }
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FormatBrandInterface}
 * @group Constraint Brands
 */
export type EmailBrandInterface = FormatBrandInterface<'email'> & string;

/**
 * Brand alias for strings validated as `format: 'idn-email'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'idn-email'>` for internationalised
 * email addresses (RFC 6531).
 *
 * @example
 * ```ts
 * const addr: IdnEmailBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link EmailBrandInterface}
 * @group Constraint Brands
 */
export type IdnEmailBrandInterface = FormatBrandInterface<'idn-email'> & string;

/**
 * Brand alias for strings validated as `format: 'uri'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'uri'>` so URI-typed fields cannot accept
 * arbitrary strings without validation.
 *
 * @example
 * ```ts
 * const href: UriBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriReferenceBrandInterface}
 * @group Constraint Brands
 */
export type UriBrandInterface = FormatBrandInterface<'uri'> & string;

/**
 * Brand alias for strings validated as `format: 'uri-reference'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'uri-reference'>` for relative or
 * absolute URI references (RFC 3986).
 *
 * @example
 * ```ts
 * const ref: UriReferenceBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriBrandInterface}
 * @group Constraint Brands
 */
export type UriReferenceBrandInterface = FormatBrandInterface<'uri-reference'> & string;

/**
 * Brand alias for strings validated as `format: 'uri-template'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'uri-template'>` for RFC 6570 URI templates.
 *
 * @example
 * ```ts
 * const tmpl: UriTemplateBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriBrandInterface}
 * @group Constraint Brands
 */
export type UriTemplateBrandInterface = FormatBrandInterface<'uri-template'> & string;

/**
 * Brand alias for strings validated as `format: 'iri'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'iri'>` for internationalised resource
 * identifiers (RFC 3987).
 *
 * @example
 * ```ts
 * const iri: IriBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link UriBrandInterface}
 * @group Constraint Brands
 */
export type IriBrandInterface = FormatBrandInterface<'iri'> & string;

/**
 * Brand alias for strings validated as `format: 'iri-reference'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'iri-reference'>` for relative or
 * absolute IRI references (RFC 3987).
 *
 * @example
 * ```ts
 * const ref: IriReferenceBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link IriBrandInterface}
 * @group Constraint Brands
 */
export type IriReferenceBrandInterface = FormatBrandInterface<'iri-reference'> & string;

/**
 * Brand alias for strings validated as `format: 'uuid'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'uuid'>` so UUID-typed fields reject
 * arbitrary strings at compile time.
 *
 * @example
 * ```ts
 * const id: UuidBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FormatBrandInterface}
 * @group Constraint Brands
 */
export type UuidBrandInterface = FormatBrandInterface<'uuid'> & string;

/**
 * Brand alias for strings validated as `format: 'date'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'date'>` for ISO 8601 full-date strings
 * (e.g. `'2024-01-15'`).
 *
 * @example
 * ```ts
 * const d: DateBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateTimeBrandInterface}
 * @group Constraint Brands
 */
export type DateBrandInterface = FormatBrandInterface<'date'> & string;

/**
 * Brand alias for strings validated as `format: 'date-time'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'date-time'>` for ISO 8601 date-time
 * strings including timezone offset.
 *
 * @example
 * ```ts
 * const ts: DateTimeBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateBrandInterface}
 * @group Constraint Brands
 */
export type DateTimeBrandInterface = FormatBrandInterface<'date-time'> & string;

/**
 * Brand alias for strings validated as `format: 'time'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'time'>` for ISO 8601 full-time strings
 * (e.g. `'14:30:00Z'`).
 *
 * @example
 * ```ts
 * const t: TimeBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateTimeBrandInterface}
 * @group Constraint Brands
 */
export type TimeBrandInterface = FormatBrandInterface<'time'> & string;

/**
 * Brand alias for strings validated as `format: 'duration'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'duration'>` for ISO 8601 duration
 * strings (e.g. `'P1Y2M3DT4H5M6S'`).
 *
 * @example
 * ```ts
 * const dur: DurationBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DateTimeBrandInterface}
 * @group Constraint Brands
 */
export type DurationBrandInterface = FormatBrandInterface<'duration'> & string;

/**
 * Brand alias for strings validated as `format: 'hostname'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'hostname'>` for RFC 1123 internet host
 * names.
 *
 * @example
 * ```ts
 * const host: HostnameBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link IdnHostnameBrandInterface}
 * @group Constraint Brands
 */
export type HostnameBrandInterface = FormatBrandInterface<'hostname'> & string;

/**
 * Brand alias for strings validated as `format: 'idn-hostname'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'idn-hostname'>` for internationalised
 * host names (RFC 5891).
 *
 * @example
 * ```ts
 * const host: IdnHostnameBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link HostnameBrandInterface}
 * @group Constraint Brands
 */
export type IdnHostnameBrandInterface = FormatBrandInterface<'idn-hostname'> & string;

/**
 * Brand alias for strings validated as `format: 'ipv4'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'ipv4'>` for dotted-decimal IPv4 addresses
 * (e.g. `'192.168.1.1'`).
 *
 * @example
 * ```ts
 * const addr: Ipv4BrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Ipv6BrandInterface}
 * @group Constraint Brands
 */
export type Ipv4BrandInterface = FormatBrandInterface<'ipv4'> & string;

/**
 * Brand alias for strings validated as `format: 'ipv6'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'ipv6'>` for IPv6 addresses in colon-hex
 * notation.
 *
 * @example
 * ```ts
 * const addr: Ipv6BrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Ipv4BrandInterface}
 * @group Constraint Brands
 */
export type Ipv6BrandInterface = FormatBrandInterface<'ipv6'> & string;

/**
 * Brand alias for strings validated as `format: 'regex'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'regex'>` for ECMA 262 regular expression
 * strings.
 *
 * @example
 * ```ts
 * const re: RegexBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link PatternBrandInterface}
 * @group Constraint Brands
 */
export type RegexBrandInterface = FormatBrandInterface<'regex'> & string;

/**
 * Brand alias for strings validated as `format: 'json-pointer'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'json-pointer'>` for RFC 6901 JSON
 * Pointer strings (e.g. `'/foo/bar'`).
 *
 * @example
 * ```ts
 * const ptr: JsonPointerBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link RelativeJsonPointerBrandInterface}
 * @group Constraint Brands
 */
export type JsonPointerBrandInterface = FormatBrandInterface<'json-pointer'> & string;

/**
 * Brand alias for strings validated as `format: 'relative-json-pointer'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'relative-json-pointer'>` for relative
 * JSON Pointer strings as defined in the JSON Schema draft specification.
 *
 * @example
 * ```ts
 * const rel: RelativeJsonPointerBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link JsonPointerBrandInterface}
 * @group Constraint Brands
 */
export type RelativeJsonPointerBrandInterface = FormatBrandInterface<'relative-json-pointer'> & string;

/**
 * Brand alias for strings validated as `format: 'binary'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'binary'>` for OpenAPI-flavoured binary
 * string fields (raw bytes transferred as a string).
 *
 * @example
 * ```ts
 * const bin: BinaryBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link ByteBrandInterface}
 * @group Constraint Brands
 */
export type BinaryBrandInterface = FormatBrandInterface<'binary'> & string;

/**
 * Brand alias for strings validated as `format: 'byte'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'byte'>` for base64-encoded byte strings
 * (OpenAPI `byte` format).
 *
 * @example
 * ```ts
 * const b: ByteBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link BinaryBrandInterface}
 * @group Constraint Brands
 */
export type ByteBrandInterface = FormatBrandInterface<'byte'> & string;

/**
 * Brand alias for numbers validated as `format: 'int32'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'int32'>` for 32-bit signed integers.
 * Intersected with `number` rather than `string`.
 *
 * @example
 * ```ts
 * const n: Int32BrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Int64BrandInterface}
 * @group Constraint Brands
 */
export type Int32BrandInterface = FormatBrandInterface<'int32'> & number;

/**
 * Brand alias for numbers validated as `format: 'int64'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'int64'>` for 64-bit signed integers.
 * Intersected with `number` rather than `string`.
 *
 * @example
 * ```ts
 * const n: Int64BrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link Int32BrandInterface}
 * @group Constraint Brands
 */
export type Int64BrandInterface = FormatBrandInterface<'int64'> & number;

/**
 * Brand alias for numbers validated as `format: 'float'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'float'>` for single-precision floating
 * point numbers (OpenAPI `float` format). Intersected with `number`.
 *
 * @example
 * ```ts
 * const n: FloatBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link DoubleBrandInterface}
 * @group Constraint Brands
 */
export type FloatBrandInterface = FormatBrandInterface<'float'> & number;

/**
 * Brand alias for numbers validated as `format: 'double'`.
 *
 * @remarks
 * Specialises `FormatBrandInterface<'double'>` for double-precision floating
 * point numbers (OpenAPI `double` format). Intersected with `number`.
 *
 * @example
 * ```ts
 * const n: DoubleBrandInterface = coerce(schema, value);
 * ```
 *
 * @category Constraint Brands
 * @since 0.18.0
 * @see {@link FloatBrandInterface}
 * @group Constraint Brands
 */
export type DoubleBrandInterface = FormatBrandInterface<'double'> & number;
