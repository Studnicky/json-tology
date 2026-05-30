/**
 * value.cast — Example 2: Cast URL query params for a Review filter
 * Demonstrates: string-coerced rating '4' → 4 (number), schema defaults applied
 *
 * Query parameters arrive as strings from the URL. value.cast coerces
 * compatible types automatically when enableTypeCast is active. The
 * canonical Bastian Balthazar Bux review fixture provides the base data.
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreSchemas, ReviewSchema
} from '../bookstore/index.js';

// A registry with enableTypeCast active.
// bookstoreSchemas seeds all transitive $refs (IsbnSchema, CustomerIdSchema,
// Iso8601Schema, RatingScoreSchema, ReviewIdSchema, etc.) so ReviewSchema's
// references resolve correctly.
const castEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableTypeCast': true,
  'schemas': bookstoreSchemas
});

// string from query param — coerced to 4 (number)
// Simulate req.query.rating = '4' (a string from the URL).
const params = castEntities.value.cast(ReviewSchema.$id, {
  'body': aboxFixtures.review.body,
  'bookIsbn': aboxFixtures.review.bookIsbn,
  'customerId': aboxFixtures.review.customerId,
  'postedAt': aboxFixtures.review.postedAt,
  'rating': '4',
  'reviewId': aboxFixtures.review.reviewId
}) as Record<string, unknown>;

console.assert((params as { 'rating': number }).rating === 4);
console.assert(typeof (params as { 'rating': number }).rating === 'number');
