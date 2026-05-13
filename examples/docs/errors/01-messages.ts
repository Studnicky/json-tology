/**
 * ValidationErrors — messages recipe
 * Demonstrates: path-prefixed string array — cookbook recipe for the removed messages() method.
 * Use this when you want a flat list of strings for console output or logging.
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

// Recipe: path-prefixed messages (equivalent to removed messages())
const messages = errs.items.map((err) => {
  return `${err.path || 'root'}: ${err.message}`;
});

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
