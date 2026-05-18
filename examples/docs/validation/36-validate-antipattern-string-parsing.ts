/**
 * validate — Anti-pattern 2: Re-parsing message strings to extract field paths
 * Demonstrates: fragile string parsing (bad) vs iterating structured errors (correct)
 *
 * An invalid customer body surfaces errors; the correct approach reads .path
 * directly from each ValidationErrorType rather than parsing formatted strings.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const invalidBody = {
  'email': 'not-an-email',
  'id': 'x'
};

// Anti-pattern: parsing formatted strings is fragile
// Don't do this
const errsForAntipattern = bookstoreEntities.validate(CustomerSchema.$id, invalidBody);
const msg = errsForAntipattern.items[0]?.message ?? '';

// fragile string parsing
const _fragileExtract = msg.split(':')[0];

void _fragileExtract;

// Correct approach: iterate the structured ValidationErrorType objects
const structured = bookstoreEntities.validate(CustomerSchema.$id, invalidBody);

for (const err of structured) {
  console.assert(typeof err.path === 'string');
  console.assert(typeof err.keyword === 'string');
  console.assert(typeof err.message === 'string');
}

console.assert(!structured.ok);
