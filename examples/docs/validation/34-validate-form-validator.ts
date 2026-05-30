/**
 * validate — Example 3: Use as a lightweight form validator
 * Demonstrates: validate on blur, return ValidationErrors to caller
 *
 * A review form validator validates before attempting a full instantiate.
 * Rating above maximum and short body surface as field-level errors.
 */

import type { ValidationErrors } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

function validateReviewForm(formData: Record<string, unknown>): ValidationErrors {
  return bookstoreEntities.validate(ReviewSchema.$id, formData);
}

const fieldErrors = validateReviewForm({
  // minLength: 10 violated
  'body': 'hi',
  'bookIsbn': aboxFixtures.rareBook.isbn,
  'customerId': aboxFixtures.customer.customerId,
  'postedAt': '2026-04-20T09:15:00Z',
  // maximum: 5 violated
  'rating': 6,
  'reviewId': aboxFixtures.review.reviewId
});

console.assert(!fieldErrors.ok);
console.assert(fieldErrors.length >= 2);
// Errors reference specific field paths
console.assert(fieldErrors.items.some((err) => {
  return err.path.includes('rating') || err.path.includes('body');
}));
