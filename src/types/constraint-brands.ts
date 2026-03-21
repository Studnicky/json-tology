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
