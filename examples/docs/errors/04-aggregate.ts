/**
 * ValidationErrors.aggregate — Example 1: Compact rollup for structured logging
 * Demonstrates: count/paths/keywords, bounded cardinality for metrics
 */

import {
  bookstoreJt, ReviewSchema
} from '../bookstore/schemas.js';

const errs = bookstoreJt.errors(ReviewSchema.$id, {
  'body': 'short',
  'bookIsbn': '9780140449136',
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'id': 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'postedAt': '2026-01-15T10:30:00Z',
  'rating': 6
});

const rollup = errs.aggregate();

console.assert(typeof rollup.count === 'number' && rollup.count >= 2);
console.assert(Array.isArray(rollup.paths));
console.assert(Array.isArray(rollup.keywords));
console.assert(rollup.paths.every((pathStr) => {
  return typeof pathStr === 'string';
}));
console.assert(rollup.keywords.every((keywordStr) => {
  return typeof keywordStr === 'string';
}));
