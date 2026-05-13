/**
 * BookRatingHistogram — demonstrates prefixItems tuple inference + pairwise distinctness.
 *
 * A fixed-length tuple of five integer counts, one slot per star rating (1–5).
 * InferType resolves to a readonly 5-tuple: [number, number, number, number, number]
 * where each element is typed via its prefixItems entry.
 *
 * The `uniqueItems: true` flag + pairwise-distinctness check is exercised here:
 * because each slot holds `{ type: 'integer' }` (not literal consts), the runtime
 * uniqueItems constraint still applies but the compile-time pairwise check falls
 * back to the branded array form (element type is not a literal union).
 *
 * Demonstrates:
 *   - prefixItems → readonly fixed-length tuple inference
 *   - uniqueItems: true on a tuple → UniqueItemsBrandInterface applied
 *   - Compile-time pairwise check (literal const slots would collapse to never on dupe)
 *
 * Slot order: [oneStarCount, twoStarCount, threeStarCount, fourStarCount, fiveStarCount]
 */

export const BookRatingHistogramSchema = {
  '$id': 'urn:bookstore:BookRatingHistogram',
  'description': 'Five-element histogram of star-rating counts: [1-star, 2-star, 3-star, 4-star, 5-star]',
  'prefixItems': [
    {
      'description': '1-star count',
      'minimum': 0,
      'type': 'integer'
    },
    {
      'description': '2-star count',
      'minimum': 0,
      'type': 'integer'
    },
    {
      'description': '3-star count',
      'minimum': 0,
      'type': 'integer'
    },
    {
      'description': '4-star count',
      'minimum': 0,
      'type': 'integer'
    },
    {
      'description': '5-star count',
      'minimum': 0,
      'type': 'integer'
    }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;
