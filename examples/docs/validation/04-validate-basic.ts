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

// Missing required fields — only email present.
const bad = bookstoreEntities.validate(CustomerSchema.$id, {
  'email': aboxFixtures.customer.email
  // id and name missing
});

console.assert(bad.length > 0);
console.assert(bad.items.some((err) => {
  return err.message.includes('id') || err.path.includes('id');
}));
