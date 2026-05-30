/**
 * value.convert — Example 1: Convert types without filling defaults
 * Demonstrates: string '5' → number 5, no schema defaults applied
 *
 * A review submission arrives with rating as a string. value.convert coerces
 * the type without applying schema defaults. The canonical Bastian Balthazar
 * Bux review of the 1979 Thienemann Neverending Story first edition provides
 * the fixture data.
 */

import { JsonTology } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreSchemas, ReviewSchema
} from '../bookstore/index.js';

// bookstoreSchemas seeds all transitive $refs so ReviewSchema's references
// (IsbnSchema, CustomerIdSchema, Iso8601Schema, etc.) resolve correctly.
const castEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableTypeCast': true,
  'schemas': bookstoreSchemas
});

// string coerced to number — no defaults applied
const converted = castEntities.value.convert(ReviewSchema.$id, {
  'body': aboxFixtures.review.body,
  'bookIsbn': aboxFixtures.review.bookIsbn,
  'customerId': aboxFixtures.review.customerId,
  'postedAt': aboxFixtures.review.postedAt,
  'rating': '5',
  'reviewId': aboxFixtures.review.reviewId
}) as Record<string, unknown>;

console.assert((converted as { 'rating': number }).rating === 5);
console.assert(typeof (converted as { 'rating': number }).rating === 'number');
