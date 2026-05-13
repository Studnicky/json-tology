/**
 * Quantity — primitive demonstrating a numeric format brand.
 *
 * InferType resolves to: number & FormatBrandInterface<'int32'>
 * (aliased as Int32BrandInterface in ConstraintBrands.ts).
 *
 * Demonstrates:
 *   - format: 'int32' on a numeric schema → Int32BrandInterface
 *   - Numeric format branding keeps the constraint visible in IDE hovers
 *     and prevents plain `number` from satisfying the type without going
 *     through JsonTology.instantiate / coerce / materialize
 */

export const QuantitySchema = {
  '$id': 'urn:bookstore:Quantity',
  'format': 'int32',
  'minimum': 1,
  'type': 'integer'
} as const;
