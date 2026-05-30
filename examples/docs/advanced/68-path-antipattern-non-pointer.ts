/**
 * Path anti-pattern — passing a dot-path instead of a JSON Pointer.
 *
 * `Path.toAccess` expects an RFC 6901 JSON Pointer (leading slash,
 * slash-separated segments). Passing a JS dot-path (e.g. `items.0.quantity`)
 * treats the whole string as one segment and produces incorrect output.
 *
 * Demonstrates: wrong vs. correct input for Path.toAccess.
 */

import { Path } from '../../../src/index.js';

// Anti-pattern: dot-path is not a JSON Pointer — no leading slash means
// split('/').slice(1) produces an empty array, so the result is '' (root pointer)
const wrongResult = Path.toAccess('items.0.quantity');

// Without a leading slash the string is treated as a root pointer — result is ''
console.assert(
  wrongResult === '',
  'dot-path without leading slash collapses to empty string (incorrect for navigation)'
);

// Correct: pass a valid RFC 6901 JSON Pointer with leading slash
const correctResult = Path.toAccess('/items/0/quantity');

console.assert(
  correctResult === 'items[0].quantity',
  'valid JSON Pointer converts to JS access notation'
);

console.log('Dot-path (anti-pattern) returns:', JSON.stringify(wrongResult), '— empty, not navigable');
console.log('JSON Pointer (correct) returns:', JSON.stringify(correctResult));
