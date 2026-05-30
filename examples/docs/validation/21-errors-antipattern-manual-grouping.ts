/**
 * ValidationErrors — Anti-pattern 2: Re-implementing a built-in view
 * Demonstrates: manual grouping (bad) vs .aggregate() (correct)
 *
 * A review with invalid rating and short body produces multiple field errors.
 * Rolling your own accumulator loop duplicates what .aggregate() provides.
 */

import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const errs = bookstoreEntities.validate(ReviewSchema.$id, {
  'body': 'hi',
  'bookIsbn': aboxFixtures.rareBook.isbn,
  'customerId': aboxFixtures.customer.customerId,
  'postedAt': '2026-04-20T09:15:00Z',
  'rating': 6,
  'reviewId': aboxFixtures.review.reviewId
});

// Anti-pattern: rolling your own path-to-messages accumulator
// Don't do this
const manualGrouped: Record<string, string[]> = {};

for (const item of errs.items) {
  const key = item.path.length > 0 ? item.path : '_root';

  (manualGrouped[key] ??= []).push(item.message);
}

// Correct approach: use .aggregate() or .items directly
const agg = errs.aggregate();

console.assert(agg.count === errs.length);
console.assert(agg.paths.length <= errs.length);

// The aggregate paths cover the same fields as manual grouping
console.assert(
  agg.paths.every((path) => {
    return Object.keys(manualGrouped).includes(path) || path === '_root';
  }),
  'aggregate paths should correspond to the manually grouped paths'
);
