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

export interface ContainsBrandInterface<T> { readonly [CONTAINS]: T }
export interface ContentEncodingBrandInterface<T extends string> { readonly [CONTENT_ENCODING]: T }
export interface ContentMediaTypeBrandInterface<T extends string> { readonly [CONTENT_MEDIA_TYPE]: T }
export interface DialectBrandInterface<T extends string> { readonly [DIALECT]: T }
export interface ExclusiveMaximumBrandInterface<TN extends number> { readonly [EXCLUSIVE_MAXIMUM]: TN }
export interface ExclusiveMinimumBrandInterface<TN extends number> { readonly [EXCLUSIVE_MINIMUM]: TN }
export interface FormatBrandInterface<TF extends string> { readonly [FORMAT]: TF }
export interface MaxItemsBrandInterface<TN extends number> { readonly [MAX_ITEMS]: TN }
export interface MaxLengthBrandInterface<TN extends number> { readonly [MAX_LENGTH]: TN }
export interface MaxPropertiesBrandInterface<TN extends number> { readonly [MAX_PROPERTIES]: TN }
export interface MaximumBrandInterface<TN extends number> { readonly [MAXIMUM]: TN }
export interface MinItemsBrandInterface<TN extends number> { readonly [MIN_ITEMS]: TN }
export interface MinLengthBrandInterface<TN extends number> { readonly [MIN_LENGTH]: TN }
export interface MinPropertiesBrandInterface<TN extends number> { readonly [MIN_PROPERTIES]: TN }
export interface MinimumBrandInterface<TN extends number> { readonly [MINIMUM]: TN }
export interface MultipleOfBrandInterface<TN extends number> { readonly [MULTIPLE_OF]: TN }
export interface PatternBrandInterface<TP extends string> { readonly [PATTERN]: TP }
export interface SchemaIdBrandInterface<TId extends string> { readonly [SCHEMA_ID]: TId }
export interface UniqueItemsBrandInterface { readonly [UNIQUE_ITEMS]: true }

/**
 * Generic uniqueness brand parameterised by element type. Lets downstream APIs
 * assume distinctness post-validation. Produced by `JsonTology.instantiate`
 * (and `coerce` / `materialize`) when the source schema declares
 * `uniqueItems: true`. Plain arrays cannot satisfy this brand without going
 * through the validation API.
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
 * (`JsonTology.instantiate`, `JsonTology.coerce`, `JsonTology.materialize`,
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
export type EmailBrandInterface = FormatBrandInterface<'email'> & string;
export type IdnEmailBrandInterface = FormatBrandInterface<'idn-email'> & string;
export type UriBrandInterface = FormatBrandInterface<'uri'> & string;
export type UriReferenceBrandInterface = FormatBrandInterface<'uri-reference'> & string;
export type UriTemplateBrandInterface = FormatBrandInterface<'uri-template'> & string;
export type IriBrandInterface = FormatBrandInterface<'iri'> & string;
export type IriReferenceBrandInterface = FormatBrandInterface<'iri-reference'> & string;
export type UuidBrandInterface = FormatBrandInterface<'uuid'> & string;
export type DateBrandInterface = FormatBrandInterface<'date'> & string;
export type DateTimeBrandInterface = FormatBrandInterface<'date-time'> & string;
export type TimeBrandInterface = FormatBrandInterface<'time'> & string;
export type DurationBrandInterface = FormatBrandInterface<'duration'> & string;
export type HostnameBrandInterface = FormatBrandInterface<'hostname'> & string;
export type IdnHostnameBrandInterface = FormatBrandInterface<'idn-hostname'> & string;
export type Ipv4BrandInterface = FormatBrandInterface<'ipv4'> & string;
export type Ipv6BrandInterface = FormatBrandInterface<'ipv6'> & string;
export type RegexBrandInterface = FormatBrandInterface<'regex'> & string;
export type JsonPointerBrandInterface = FormatBrandInterface<'json-pointer'> & string;
export type RelativeJsonPointerBrandInterface = FormatBrandInterface<'relative-json-pointer'> & string;
export type BinaryBrandInterface = FormatBrandInterface<'binary'> & string;
export type ByteBrandInterface = FormatBrandInterface<'byte'> & string;
export type Int32BrandInterface = FormatBrandInterface<'int32'> & number;
export type Int64BrandInterface = FormatBrandInterface<'int64'> & number;
export type FloatBrandInterface = FormatBrandInterface<'float'> & number;
export type DoubleBrandInterface = FormatBrandInterface<'double'> & number;
