/**
 * Compose.pick — Example 3: Single-field sub-schema for blur validation
 *
 * Pick a single field from the canonical ReviewSchema and register it
 * onto the bookstore. The derived schema validates the rating slot in
 * isolation — useful for incremental field-level form validation.
 */

import { Compose } from '../../../src/index.js';
import {
  createBookstoreDocRegistry,
  ReviewSchema
} from '../bookstore/index.js';

// createBookstoreDocRegistry seeds a permissive copy of the bookstore — docs examples extend
// it with ad-hoc demo schemas; strict-graph checking is intentionally off here.
const jt = createBookstoreDocRegistry();

const ReviewRatingSchema = Compose.pick(
  ReviewSchema,
  ['rating'] as const,
  'https://bookstore.example/ReviewRating'
);

const jt2 = jt.set(ReviewRatingSchema);

// A 5 passes — within 0..5.
const okResult = jt2.validate(ReviewRatingSchema.$id, { 'rating': 5 });

console.assert(okResult.ok);
console.log('ReviewRating validates rating=5:', okResult.ok);

// A 6 fails — exceeds the canonical rating cap.
const overResult = jt2.validate(ReviewRatingSchema.$id, { 'rating': 6 });

console.assert(!overResult.ok);
console.log('ReviewRating rejects rating=6:', !overResult.ok, '(exceeds max 5)');
