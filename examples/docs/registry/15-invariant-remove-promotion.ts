/**
 * removeInvariant — Example 1: Remove a review length requirement during a promotion
 * Demonstrates: addInvariant + removeInvariant for runtime rule toggling
 *
 * During a promotional event the minimum body length for 5-star reviews is
 * temporarily relaxed. The canonical Bastian Balthazar Bux review of the
 * 1979 Thienemann Neverending Story first edition is used as the fixture.
 */

import type { Review } from '../bookstore/index.js';
import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

const INVARIANT_NAME = 'promotionalBodyLength';

// Register the invariant (minimum 50 chars for 5-star reviews).
bookstoreEntities.addInvariant<Review>(ReviewSchema.$id, {
  'fn': (review) => {
    if (review.rating === 5 && review.body.length < 50) {
      return '5-star reviews must have a body of at least 50 characters';
    }

    return null;
  },
  'name': INVARIANT_NAME,
  'pointer': '/body'
});

const shortReview = {
  ...aboxFixtures.review,
  'body': 'Magnificent.',
  'rating': 5
};

// Fails while invariant is active.
console.assert(!bookstoreEntities.is(ReviewSchema.$id, shortReview));

console.log('before removal - short review valid:', bookstoreEntities.is(ReviewSchema.$id, shortReview));

// Remove during promotional event (relax minimum body length).
bookstoreEntities.removeInvariant(ReviewSchema.$id, INVARIANT_NAME);

// Passes after removal — short 5-star review is now acceptable.
console.assert(bookstoreEntities.is(ReviewSchema.$id, shortReview));

console.log('after removal - short review valid:', bookstoreEntities.is(ReviewSchema.$id, shortReview));
