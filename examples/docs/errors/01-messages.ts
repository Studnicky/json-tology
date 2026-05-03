/**
 * ValidationErrors.messages — Example 1: String array of errors
 * Demonstrates: messages() format "path: message", suitable for console/logging
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

const messages = errs.messages();

console.assert(Array.isArray(messages));
console.assert(messages.every((msgStr) => {
  return typeof msgStr === 'string';
}));
console.assert(messages.some((msgStr) => {
  return msgStr.startsWith('/rating');
}));
console.assert(messages.some((msgStr) => {
  return msgStr.startsWith('/body');
}));
