/**
 * toSchema — Example 1: Round-trip an Order schema
 * Demonstrates: reconstructed schema from the canonical graph, JSON-serializable
 *
 * bookstoreEntities.toSchema returns the Order schema as a plain object
 * reconstructed from the internal canonical graph. It should contain the
 * structural properties declared in OrderSchema.
 */

import {
  bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const reconstructed = bookstoreEntities.toSchema(OrderSchema.$id);

console.assert(reconstructed !== undefined, 'Registered schema should return a value');

// Should be JSON-serializable without throwing
const serialized = JSON.stringify(reconstructed, null, 2);

console.assert(typeof serialized === 'string');
console.assert(serialized.length > 0);

// Reconstructed schema reflects the normalized canonical form
const rec = reconstructed as Record<string, unknown>;

console.assert('type' in rec, 'Reconstructed schema should have a type field');

// Show the reconstructed schema as produced from the canonical graph
console.log('reconstructed Order schema:', serialized);
