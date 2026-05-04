/**
 * ValidationErrors.format — Example 1: Group errors by JSON Pointer path
 * Demonstrates: format() for form field highlighting
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

const grouped = errs.format();

console.assert(typeof grouped === 'object');
console.assert(Array.isArray(grouped['/rating']));
console.assert(Array.isArray(grouped['/body']));
console.assert(grouped['/rating'].every((m: string) => {
  return typeof m === 'string';
}));
