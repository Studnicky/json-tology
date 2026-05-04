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
const entities = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'schemas': [CustomerSchema] as const
});

console.assert(entities.has(CustomerSchema.$id));
console.assert(!entities.has(BookSchema.$id));

// Post-construction register
entities.register(BookSchema);
console.assert(entities.has(BookSchema.$id));

// Retrieve schema object
const raw = entities.get(BookSchema.$id);

console.assert(raw !== undefined);


// List all registered IDs
const ids = entities.list();

console.assert(ids.includes(CustomerSchema.$id));
console.assert(ids.includes(BookSchema.$id));

// registerAnonymous — no $id needed
const syntheticId = entities.registerAnonymous({
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
console.assert(entities.has(syntheticId));
