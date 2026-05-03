import type { ParseOutputType } from './Transform.js';

declare const BRAND: unique symbol;

export interface BrandTagInterface<TBrand extends string> { readonly [BRAND]: TBrand }

/**
 * A schema annotated with a brand name.
 * The underlying JSON Schema is unchanged; only the TypeScript type is wider.
 */
export type BrandedType<TSchema, TBrand extends string> = BrandTagInterface<TBrand> & TSchema;

/**
 * Derive the branded output type from a schema.
 * For a non-branded schema returns ParseOutputType<TSchema> unchanged.
 */
export type BrandOutputType<TSchema>
  = TSchema extends BrandTagInterface<infer B extends string>
    ? ParseOutputType<TSchema> & { readonly 'brand': B }
    : ParseOutputType<TSchema>;
