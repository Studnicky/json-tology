/**
 * EstimatedAgeYears — non-negative integer estimate of a book's age in years.
 *
 * Used for RareBook.estimatedAgeYears. The age is an approximation; zero is
 * valid for a newly-acquired item whose age is not yet determined. Age is
 * always a whole-year count.
 *
 * Distinct from RatingCount (histogram bucket count) and FileSizeBytes
 * (byte count), which share the same { minimum: 0, type: 'integer' } shape
 * but carry different domain semantics.
 */

export const EstimatedAgeYearsSchema = {
  '$id': 'urn:bookstore:EstimatedAgeYears',
  'minimum': 0,
  'type': 'integer'
} as const;
