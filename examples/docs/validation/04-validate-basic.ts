/**
 * validate — Example 1: Basic valid and invalid cases
 * Demonstrates: empty collection on success (.ok, .length), ValidationErrors on failure
 */

import {
  CustomerSchema, bookstoreEntities as entities
} from '../bookstore/index.js';

// Valid input
const ok = entities.validate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
});

console.assert(ok.length === 0);

// Missing required fields
const bad = entities.validate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example'
  // id and name missing
});

console.assert(bad.length > 0);
console.assert(bad.items.some((err) => {
  return err.message.includes('id') || err.path.includes('id');
}));
