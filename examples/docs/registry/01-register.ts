/**
 * register / has / get / list — Example 1: Registry lifecycle
 * Demonstrates: construction-time registration, post-construction register,
 * has/get/list inspection
 */

import {
  JsonTology
} from '../../../src/index.js';
import {
  BookSchema, CustomerSchema
} from '../bookstore/schemas.js';

// Construction-time registration
const bookstoreJt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [CustomerSchema] as const
});

console.assert(bookstoreJt.has('https://bookstore.example/Customer'));
console.assert(!bookstoreJt.has('https://bookstore.example/Book'));

// Post-construction register
bookstoreJt.register(BookSchema);
console.assert(bookstoreJt.has('https://bookstore.example/Book'));

// Retrieve schema object
const raw = bookstoreJt.get('https://bookstore.example/Book');

console.assert(raw !== undefined);


// List all registered IDs
const ids = bookstoreJt.list();

console.assert(ids.includes('https://bookstore.example/Customer'));
console.assert(ids.includes('https://bookstore.example/Book'));

// registerAnonymous — no $id needed
const syntheticId = bookstoreJt.registerAnonymous({
  'properties': {
    'couponCode': { 'type': 'string' },
    'discount': { 'type': 'number' }
  },
  'required': [
    'couponCode',
    'discount'
  ],
  'type': 'object'
});

console.assert(typeof syntheticId === 'string' && syntheticId.length > 0);
console.assert(bookstoreJt.has(syntheticId));
