/**
 * ValidationErrors.report — Example 1: RFC 7807 Problem Details payload
 * Demonstrates: report() for HTTP 422 responses
 */

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

const problem = errs.report({ 'instance': '/reviews' });

console.assert(problem.status === 422);
console.assert(problem.type === 'https://json-tology.dev/problems/validation');
console.assert(problem.title === 'Validation failed');
console.assert(problem.instance === '/reviews');
console.assert(Array.isArray(problem.errors));
console.assert(problem.errors.every((errEntry) => {
  return typeof errEntry.path === 'string'
    && typeof errEntry.keyword === 'string'
    && typeof errEntry.message === 'string';
}));
