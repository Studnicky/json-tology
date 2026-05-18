/**
 * dumpJson — Example 1: Serialize a customer for an HTTP response
 * Demonstrates: dumpJson returns a JSON string; all fields included
 *
 * Bastian Balthazar Bux — the canonical customer fixture instantiated
 * and serialized to a JSON string suitable for an HTTP response body.
 */

import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const customer = bookstoreEntities.instantiate(CustomerSchema, {
  'addresses': [aboxFixtures.order.shippingAddress],
  'email': 'bastian.bux@bookstore.example',
  'id': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'name': 'Bastian Balthazar Bux'
});

const json = bookstoreEntities.dumpJson(CustomerSchema.$id, customer);

// dumpJson always returns a string
console.assert(typeof json === 'string');

const parsed = JSON.parse(json) as Record<string, unknown>;

console.assert(parsed.id === 'c1a2b3d4-e5f6-7890-abcd-ef1234567890');
console.assert(parsed.email === 'bastian.bux@bookstore.example');
console.assert(parsed.name === 'Bastian Balthazar Bux');
console.assert(Array.isArray(parsed.addresses));
