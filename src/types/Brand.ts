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

/**
 * Phantom brand projection. Compose / Transform return plain JS objects whose
 * shape is captured by a branded interface for compile-time enforcement. The
 * brand itself is a phantom (unique-symbol) field with no runtime presence,
 * so the cast is structurally safe — every property of the branded interface
 * is satisfied by the underlying object except the brand, which is a
 * compile-time-only fiction.
 */
export function brand<TBranded>(value: unknown): TBranded {
  return value as TBranded;
}
