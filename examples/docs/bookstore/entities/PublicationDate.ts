/**
 * PublicationDate — primitive demonstrating the `date` format brand.
 *
 * InferType resolves to: string & FormatBrandType<'date'>
 * (aliased as DateBrandType in ConstraintBrands.ts).
 *
 * Demonstrates:
 *   - format: 'date' → DateBrandType (distinct from Iso8601's date-time brand)
 *   - Runtime: enforces ISO 8601 calendar date (YYYY-MM-DD) without time component
 *
 * Contrast with Iso8601 (format: 'date-time') which includes time and timezone.
 */

export const PublicationDateSchema = {
  '$id': 'urn:bookstore:PublicationDate',
  'format': 'date',
  'type': 'string'
} as const;
