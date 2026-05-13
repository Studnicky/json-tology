/**
 * validate — Example 3: Structured ValidationErrors collection
 * Demonstrates: .ok, .length, iteration, path/keyword/message/params
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

console.assert(!errs.ok);
console.assert(errs.length >= 2);

let foundRating = false;
let foundBody = false;

for (const errItem of errs) {
  if (errItem.path === '/rating') {
    foundRating = true;
  }

  if (errItem.path === '/body') {
    foundBody = true;
  }

  console.assert(typeof errItem.keyword === 'string');
  console.assert(typeof errItem.message === 'string');
}

console.assert(foundRating);
console.assert(foundBody);
