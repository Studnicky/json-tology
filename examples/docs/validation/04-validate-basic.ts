/**
 * validate — Example 1: Basic valid and invalid cases
 * Demonstrates: empty array on success, error strings on failure
 */

import {
  bookstoreJt, CustomerSchema
} from '../bookstore/index.js';

// Valid input
const ok = bookstoreJt.validate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
});

console.assert(ok.length === 0);

// Missing required fields
const bad = bookstoreJt.validate(CustomerSchema.$id, {
  'email': 'alice@bookstore.example'
  // id and name missing
});

console.assert(bad.length > 0);
console.assert(bad.some((msg) => {
  return msg.includes('id');
}));
