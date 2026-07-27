/**
 * The set of primitive enum values compiled to a `Set` for O(1) membership testing.
 *
 * @remarks
 * Used when the schema declares an `enum` whose values are all primitives
 * (which require no deep-equality check). The fast-path uses `Set.has` to
 * test membership before falling through to the full enum validator.
 *
 * @category Validation
 * @since 0.1.0
 */
export interface EnumPrimitiveSetInterface extends Set<boolean | null | number | string> {}
