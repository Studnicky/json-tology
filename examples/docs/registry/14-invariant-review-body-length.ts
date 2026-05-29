/**
 * addInvariant — Example 3: Imperative add after construction (review body length)
 * Demonstrates: addInvariant<T> with pointer, runtime add to existing registry
 *
 * A 5-star review of Michael Ende's Die unendliche Geschichte (1979 Thienemann
 * first edition) must have a body of at least 50 characters. The invariant is
 * registered imperatively against the already-constructed bookstore registry.
 */

import type { Review } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

bookstoreEntities.addInvariant<Review>(ReviewSchema.$id, {
  'fn': (review) => {
    if (review.rating === 5 && review.body.length < 50) {
      return '5-star reviews must have a body of at least 50 characters';
    }

    return null;
  },
  'name': 'highRatingRequiresDetailedReview',
  'pointer': '/body'
});

// The canonical review fixture has rating 5 and a sufficiently long body — passes.
const validResult = bookstoreEntities.validate(ReviewSchema.$id, aboxFixtures.review);

console.assert(validResult.ok);

// A terse 5-star review triggers the invariant.
const shortReview = {
  ...aboxFixtures.review,
  'body': 'Perfect.',
  'rating': 5
};

const failResult = bookstoreEntities.validate(ReviewSchema.$id, shortReview);

console.assert(!failResult.ok);
console.assert(failResult.items.some((errItem) => {
  return errItem.keyword === 'jt:invariant';
}));

// Cleanup.
bookstoreEntities.removeInvariant(ReviewSchema.$id, 'highRatingRequiresDetailedReview');
