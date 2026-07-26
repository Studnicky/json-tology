/**
 * ValidationErrors — flatten recipe
 * Demonstrates: fieldErrors / formErrors split — cookbook recipe for the removed flatten() method.
 * Use this when you need to separate field-level errors from form-level errors.
 */

import type { ValidationErrorEntity } from '../../../src/types/index.js';
import {
  bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'short',
  'bookIsbn': '9780140449136',
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'postedAt': '2026-01-15T10:30:00Z',
  'rating': 6
});

// Recipe: field vs form errors (equivalent to removed flatten())
const fieldErrors: ValidationErrorEntity.Type[] = [];
const formErrors: ValidationErrorEntity.Type[] = [];

for (const err of errs) {
  if (err.path) {
    fieldErrors.push(err);
  } else {
    formErrors.push(err);
  }
}

console.assert(typeof fieldErrors === 'object');
console.assert(Array.isArray(formErrors));
// Field errors: items with non-empty paths
console.assert(fieldErrors.some((err) => {
  return err.path === '/rating';
}));
console.assert(fieldErrors.some((err) => {
  return err.path === '/body';
}));
