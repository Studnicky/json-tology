/**
 * ValidationErrors — format recipe
 * Demonstrates: grouping errors by JSON Pointer path — cookbook recipe for the removed format() method.
 * Use this when you need to map errors to specific form fields.
 */

import type { ValidationErrorType } from '../../../src/types/index.js';
import {
  bookstoreEntities as entities, ReviewSchema
} from '../bookstore/index.js';

const errs = entities.validate(ReviewSchema.$id, {
  'body': 'short',
  'bookIsbn': '9780140449136',
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'postedAt': '2026-01-15T10:30:00Z',
  'rating': 6
});

// Recipe: group by path (equivalent to removed format())
const grouped: Record<string, ValidationErrorType[]> = {};

for (const err of errs) {
  const key = err.path || '_root';

  (grouped[key] ??= []).push(err);
}

console.assert(typeof grouped === 'object');
console.assert(Array.isArray(grouped['/rating']));
console.assert(Array.isArray(grouped['/body']));
console.assert((grouped['/rating'] ?? []).every((err) => {
  return typeof err.message === 'string';
}));
