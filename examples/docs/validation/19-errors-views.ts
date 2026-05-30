/**
 * ValidationErrors — Example 3: Structured views on a failed review
 * Demonstrates: .items map, .aggregate(), .report()
 *
 * A review with a rating above the maximum and too-short body
 * triggers multiple validation errors.
 */

import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  // minLength: 10 violated
  'body': 'hi',
  'bookIsbn': aboxFixtures.rareBook.isbn,
  'customerId': aboxFixtures.customer.customerId,
  'postedAt': '2026-04-20T09:15:00Z',
  // maximum: 5 violated
  'rating': 6,
  'reviewId': aboxFixtures.review.reviewId
});

console.assert(!errs.ok);

// string[] — one message per error
const messages = errs.items.map((err) => {
  return `${err.path}: ${err.message}`;
});

console.assert(Array.isArray(messages));
console.assert(messages.length > 0);
console.log('field errors:', messages);

// Aggregate rollup for logs and metrics
const agg = errs.aggregate();

console.assert(typeof agg.count === 'number' && agg.count > 0);
console.assert(Array.isArray(agg.paths));
console.assert(Array.isArray(agg.keywords));
console.log('aggregate: count =', agg.count, ', paths =', agg.paths, ', keywords =', agg.keywords);

// RFC 7807 Problem Details payload
const problem = errs.report();

console.assert(typeof problem === 'object');
console.assert('status' in problem && (problem as { 'status': number }).status === 422);
console.log('report status:', (problem as { 'status': number }).status);
