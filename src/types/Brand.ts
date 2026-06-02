import type { ParseOutputType } from './Transform.js';

declare const BRAND: unique symbol;

/**
 * Compile-time phantom tag interface that marks a type as carrying a named brand.
 *
 * @remarks
 * Uses a `unique symbol` field so the brand is never present at runtime; it
 * exists only in the type system. Consumers should not implement this interface
 * directly — use {@link BrandedType} or the `Transform.brand` factory instead.
 * The `TBrand` string literal flows through to {@link BrandOutputType} so that
 * the inferred output type is annotated with a `brand` property for
 * documentation and pattern-matching purposes.
 *
 * @example
 * ```ts
 * declare const tag: BrandTagInterface<'UserId'>;
 * // tag[BRAND] is 'UserId' at compile time, absent at runtime
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link BrandedType}
 * @group Schema Utilities
 *
 * @typeParam TBrand - The string literal that identifies this brand.
 */
export interface BrandTagInterface<TBrand extends string> { readonly [BRAND]: TBrand }

/**
 * A schema annotated with a brand name.
 *
 * @remarks
 * Widens the schema literal type with a {@link BrandTagInterface} phantom tag.
 * The underlying JSON Schema structure is unchanged; only the TypeScript type
 * carries the additional brand marker. Used by `Transform.brand` to produce a
 * schema that records its brand name so downstream `InferType` calls can
 * include a `brand` property on the inferred output type.
 *
 * @example
 * ```ts
 * type TaggedId = BrandedType<typeof IdSchema, 'UserId'>;
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link BrandTagInterface}
 * @group Schema Utilities
 *
 * @typeParam TSchema - The underlying JSON Schema literal to annotate.
 * @typeParam TBrand - The string literal that identifies the brand.
 */
export type BrandedType<TSchema, TBrand extends string> = BrandTagInterface<TBrand> & TSchema;

/**
 * Derive the branded output type from a schema.
 *
 * @remarks
 * When `TSchema` extends {@link BrandTagInterface}, the inferred output type is
 * intersected with `{ readonly 'brand': B }` so that the brand name is visible
 * on the resulting JS type. For a non-branded schema this reduces to
 * `ParseOutputType<TSchema>` unchanged. Used internally by `InferType` to
 * propagate brand annotations from authored schemas to their inferred types.
 *
 * @example
 * ```ts
 * type IdSchema = BrandedType<{ type: 'string' }, 'UserId'>;
 * type Id = BrandOutputType<IdSchema>; // string & { readonly brand: 'UserId' }
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link BrandedType}
 * @group Schema Utilities
 *
 * @typeParam TSchema - The schema to derive the branded output type from.
 */
export type BrandOutputType<TSchema>
  = TSchema extends BrandTagInterface<infer B extends string>
    ? ParseOutputType<TSchema> & { readonly 'brand': B }
    : ParseOutputType<TSchema>;

/**
 * Phantom brand projection — casts an untyped value to a branded type.
 *
 * @remarks
 * Compose and Transform return plain JS objects whose shape is captured by a
 * branded interface for compile-time enforcement. The brand itself is a phantom
 * (unique-symbol) field with no runtime presence, so the cast is structurally
 * safe: every property of the branded interface is satisfied by the underlying
 * object except the brand, which is a compile-time-only fiction.
 *
 * @example
 * ```ts
 * return brand<BrandedType<typeof schema, 'UserId'>>(rawSchema);
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link BrandedType}
 * @group Schema Utilities
 *
 * @param value - The runtime value to project into the branded type.
 * @returns The same value cast to `TBranded` — no runtime transformation occurs.
 *
 * @typeParam TBranded - The branded target type to project into.
 */
export function brand<TBranded>(value: unknown): TBranded {
  return value as TBranded;
}
