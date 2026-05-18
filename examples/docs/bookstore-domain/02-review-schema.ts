/**
 * Bookstore domain: ReviewSchema — entity composed of named primitives
 *
 * `ReviewSchema` composes six primitive schemas via `$ref`. Each `$ref`
 * value is `SourceSchema.$id` with an explicit named import at the top
 * of the entity file — never a bare string literal.
 *
 * Bastian Balthazar Bux's review of the 1979 Thienemann first edition
 * of "Die unendliche Geschichte" is the canonical review fixture.
 */

import {
  aboxFixtures, bookstoreEntities, ReviewSchema
} from '../bookstore/index.js';

// Validate the canonical review fixture.
const errs = bookstoreEntities.validate(ReviewSchema.$id, aboxFixtures.review);

console.assert(errs.length === 0);

// ReviewSchema is composed of six referenced primitives.
const reviewId: string = ReviewSchema.$id;
const reviewType: string = ReviewSchema.type;

console.assert(reviewId === 'urn:bookstore:Review');
console.assert(reviewType === 'object');
console.assert(ReviewSchema.required.includes('id'));
console.assert(ReviewSchema.required.includes('bookIsbn'));
console.assert(ReviewSchema.required.includes('customerId'));
console.assert(ReviewSchema.required.includes('rating'));
console.assert(ReviewSchema.required.includes('body'));
console.assert(ReviewSchema.required.includes('postedAt'));
