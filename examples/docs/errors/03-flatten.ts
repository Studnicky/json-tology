/**
 * ValidationErrors.flatten — Example 1: fieldErrors / formErrors split
 * Demonstrates: Zod-compatible flatten() for form libraries
 */

import {
  bookstoreJt, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreJt.errors(ReviewSchema.$id, {
  'body': 'short',
  'bookIsbn': '9780140449136',
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'postedAt': '2026-01-15T10:30:00Z',
  'rating': 6
});

const {
  fieldErrors, formErrors
} = errs.flatten();

console.assert(typeof fieldErrors === 'object');
console.assert(Array.isArray(formErrors));
// Field errors: keyed by JSON Pointer path
console.assert(Array.isArray(fieldErrors['/rating']));
console.assert(Array.isArray(fieldErrors['/body']));
