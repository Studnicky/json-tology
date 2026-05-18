/**
 * FirstEditionYear — Gregorian year of a book's first print run.
 *
 * Constrained to the practical range of modern print history:
 *   minimum: 1450 — the Gutenberg press era (circa 1450)
 *   maximum: 2100 — a forward buffer for pre-registration of future editions
 *
 * Used for RareBook.firstEditionYear.
 */

export const FirstEditionYearSchema = {
  '$id': 'urn:bookstore:FirstEditionYear',
  'maximum': 2100,
  'minimum': 1450,
  'type': 'integer'
} as const;
