/**
 * validate — Example 1: Basic valid and invalid cases
 * Demonstrates: empty collection on success (.ok, .length), ValidationErrors on failure
 *
 * Uses the canonical Bastian Balthazar Bux customer fixture.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

// Valid input
const ok = bookstoreEntities.validate(CustomerSchema.$id, aboxFixtures.customer);

console.assert(ok.length === 0);
console.log('valid input: ok =', ok.ok, ', errors =', ok.length);

// Missing required fields — only email present.
const bad = bookstoreEntities.validate(CustomerSchema.$id, {
  'email': aboxFixtures.customer.email
  // id and name missing
});

console.assert(bad.length > 0);
console.assert(bad.items.some((err) => {
  return err.message.toLowerCase().includes('id') || err.path.toLowerCase().includes('id');
}));
console.log('missing fields: ok =', bad.ok, ', error count =', bad.length);
console.log('first error:', bad.items[0]?.path, '-', bad.items[0]?.message);
