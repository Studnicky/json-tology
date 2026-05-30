/**
 * bookstoreEntities.dumpJson — Example 1: JSON string serialization
 * Demonstrates: returns string, excludeDefaults option
 *
 * The customer is the canonical Bastian Balthazar Bux fixture.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.instantiate(CustomerSchema.$id, aboxFixtures.customer);

const json = bookstoreEntities.dumpJson(CustomerSchema.$id, customer);

console.assert(typeof json === 'string');

const parsed = JSON.parse(json) as Record<string, unknown>;

console.assert(parsed.customerId === aboxFixtures.customer.customerId);
console.assert(parsed.email === aboxFixtures.customer.email);
console.assert(Array.isArray(parsed.addresses));
console.assert((parsed.addresses as unknown[]).length === 1);

// Show the JSON string produced for an HTTP response
console.log('dumpJson output:', json);
