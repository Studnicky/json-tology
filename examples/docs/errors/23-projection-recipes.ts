/**
 * ValidationErrors — common projection recipes
 *
 * Three frequently-asked projections off `errs.items`:
 *   • path-prefixed message strings
 *   • group-by-path map
 *   • field-vs-form bucketing
 *
 * All operate on the canonical Bastian-rates-Neverending review,
 * deliberately submitted with a too-short body and an out-of-range
 * rating to exercise both field and form errors.
 */

import type { ValidationErrorType } from '../../../src/types/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'no',
  'bookIsbn': '9783522128001',
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a4d3c2b1-a098-7654-a210-fedcba987654',
  'postedAt': '2026-04-20T09:15:00Z',
  'rating': 12
});

// Path-prefixed message strings.
const messages = errs.items.map((err) => {
  return `${err.path}: ${err.message}`;
});

// Group by path.
const grouped: Record<string, ValidationErrorType[]> = {};

for (const err of errs) {
  (grouped[err.path || '_root'] ??= []).push(err);
}

// Field vs form errors.
const fieldErrors: ValidationErrorType[] = [];
const formErrors: ValidationErrorType[] = [];

for (const err of errs) {
  if (err.path) {
    fieldErrors.push(err);
  } else {
    formErrors.push(err);
  }
}

console.assert(Array.isArray(messages));
console.assert(typeof grouped === 'object');
console.assert(Array.isArray(fieldErrors));
console.assert(Array.isArray(formErrors));
