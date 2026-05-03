/**
 * bookstoreJt.dumpJson — Example 1: JSON string serialization
 * Demonstrates: returns string, excludeDefaults option
 */

import {
  bookstoreJt, CustomerSchema
} from '../bookstore/schemas.js';

const customer = bookstoreJt.coerce(CustomerSchema.$id, {
  'email': 'alice@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Alice Chen'
});

const json = bookstoreJt.dumpJson(CustomerSchema.$id, customer);

console.assert(typeof json === 'string');

const parsed = JSON.parse(json) as Record<string, unknown>;

console.assert(parsed.id === 'c1a2b3d4-e5f6-7890-abcd-ef1234567890');
console.assert(parsed.email === 'alice@bookstore.example');
console.assert(Array.isArray(parsed.addresses));
