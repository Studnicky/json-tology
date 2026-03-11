import type { ParseOutput } from './transform.js';

declare const BRAND: unique symbol;

export type BrandTag<TBrand extends string> = { readonly [BRAND]: TBrand };

/**
 * A schema annotated with a brand name.
 * The underlying JSON Schema is unchanged; only the TypeScript type is wider.
 */
export type Branded<TSchema, TBrand extends string> = TSchema & BrandTag<TBrand>;

/**
 * Derive the branded output type from a schema.
 * For a non-branded schema returns ParseOutput<TSchema> unchanged.
 */
export type BrandOutput<TSchema> =
  TSchema extends BrandTag<infer B extends string>
    ? ParseOutput<TSchema> & { readonly __brand: B }
    : ParseOutput<TSchema>;
