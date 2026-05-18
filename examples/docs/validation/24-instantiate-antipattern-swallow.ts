/**
 * instantiate — Anti-pattern 1: Catching InstantiationError silently
 * Demonstrates: the bad swallow pattern vs surfacing the error list via validate
 *
 * Invalid customer body: missing id, name is absent — the error list is lost
 * in the anti-pattern. The correct path uses validate() to surface items.
 */

import {
  bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const invalidBody = { 'email': 'walter.moers@bookstore.example' };

// Anti-pattern: swallowing InstantiationError loses structured errors
// Don't do this
try {
  bookstoreEntities.instantiate(CustomerSchema.$id, invalidBody);
} catch {
  // swallowed — errors lost
}

// Correct approach: use validate() to surface the structured error list
const errs = bookstoreEntities.validate(CustomerSchema.$id, invalidBody);

if (!errs.ok) {
  const messages = errs.items.map((err) => {
    return `${err.path}: ${err.message}`;
  });

  console.assert(Array.isArray(messages));
  console.assert(messages.length > 0);
}

console.assert(!errs.ok);
