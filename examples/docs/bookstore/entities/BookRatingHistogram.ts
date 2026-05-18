/**
 * BookRatingHistogram — demonstrates prefixItems tuple inference + pairwise distinctness.
 *
 * A fixed-length tuple of five RatingCount values, one slot per star rating (1–5).
 * InferType resolves to a readonly 5-tuple: [number, number, number, number, number]
 * where each element is typed via its prefixItems entry.
 *
 * The `uniqueItems: true` flag + pairwise-distinctness check is exercised here:
 * because each slot holds a $ref to RatingCount (not literal consts), the runtime
 * uniqueItems constraint still applies but the compile-time pairwise check falls
 * back to the branded array form (element type is not a literal union).
 *
 * Demonstrates:
 *   - prefixItems → readonly fixed-length tuple inference
 *   - uniqueItems: true on a tuple → UniqueItemsBrandInterface applied
 *   - Compile-time pairwise check (literal const slots would collapse to never on dupe)
 *   - Named-primitive $ref for each tuple slot (strict-graph compliant)
 *
 * Slot order: [oneStarCount, twoStarCount, threeStarCount, fourStarCount, fiveStarCount]
 */

export const BookRatingHistogramSchema = {
  '$id': 'urn:bookstore:BookRatingHistogram',
  'description': 'Five-element histogram of star-rating counts: [1-star, 2-star, 3-star, 4-star, 5-star]',
  'prefixItems': [
    {
      '$ref': 'urn:bookstore:RatingCount',
      'description': '1-star count'
    },
    {
      '$ref': 'urn:bookstore:RatingCount',
      'description': '2-star count'
    },
    {
      '$ref': 'urn:bookstore:RatingCount',
      'description': '3-star count'
    },
    {
      '$ref': 'urn:bookstore:RatingCount',
      'description': '4-star count'
    },
    {
      '$ref': 'urn:bookstore:RatingCount',
      'description': '5-star count'
    }
  ],
  'type': 'array',
  'uniqueItems': true
} as const;
