/**
 * Brand — phantom brand projection function.
 *
 * Casts an untyped value to a branded type at the call site.
 * The brand itself is a phantom (unique-symbol) field with no runtime
 * presence, so the cast is structurally safe.
 */

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
 * return Brand.cast<BrandedType<typeof schema, 'UserId'>>(rawSchema);
 * ```
 *
 * @category Schema Utilities
 * @since 0.10.0
 * @see {@link BrandedType}
 * @group Schema Utilities
 */
export class Brand {
  /**
   * Phantom brand projection — casts an untyped value to a branded type.
   *
   * @param value - The runtime value to project into the branded type.
   * @returns The same value cast to `TBranded` — no runtime transformation occurs.
   *
   * @typeParam TBranded - The branded target type to project into.
   */
  public static cast<TBranded>(value: unknown): TBranded {
    const result = value as TBranded;

    return result;
  }
}
