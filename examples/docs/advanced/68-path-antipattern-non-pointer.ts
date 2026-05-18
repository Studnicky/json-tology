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

// Anti-pattern: dot-path is not a JSON Pointer — treated as one segment
const wrongResult = Path.toAccess('items.0.quantity');

// The entire dot-path is treated as a single quoted segment
console.assert(
  wrongResult === '["items.0.quantity"]',
  'dot-path is treated as one segment (incorrect for navigation)'
);

// Correct: pass a valid RFC 6901 JSON Pointer with leading slash
const correctResult = Path.toAccess('/items/0/quantity');

console.assert(
  correctResult === 'items[0].quantity',
  'valid JSON Pointer converts to JS access notation'
);
