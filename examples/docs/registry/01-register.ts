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
} from '../bookstore/index.js';

// Construction-time registration
const bookstoreEntities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [CustomerSchema] as const
});

console.assert(bookstoreEntities.registry.has(CustomerSchema.$id));
console.assert(!bookstoreEntities.registry.has(BookSchema.$id));

// Post-construction register
bookstoreEntities.register(BookSchema);
console.assert(bookstoreEntities.registry.has(BookSchema.$id));

// Retrieve schema object
const raw = bookstoreEntities.registry.get(BookSchema.$id);

console.assert(raw !== undefined);


// List all registered IDs
console.assert(bookstoreEntities.registry.has(CustomerSchema.$id));
console.assert(bookstoreEntities.registry.has(BookSchema.$id));

// registerAnonymous — no $id needed
const syntheticId = bookstoreEntities.registerAnonymous({
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
console.assert(bookstoreEntities.registry.has(syntheticId));
