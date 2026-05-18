/**
 * RatingCount — non-negative integer count of reviews at a given star level.
 *
 * Used in BookRatingHistogram as the element type for each star bucket
 * (1-star through 5-star). A count is always a whole number ≥ 0.
 *
 * Distinct from RatingScore (1–5 scale for a single review rating) and
 * Amount (a currency-bearing decimal).
 */

export const RatingCountSchema = {
  '$id': 'urn:bookstore:RatingCount',
  'minimum': 0,
  'type': 'integer'
} as const;
