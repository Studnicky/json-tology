/**
 * Hash: stable cache key for schema content fingerprint
 *
 * Use Hash.value to produce a deterministic fingerprint for a schema object.
 * Two structurally identical schemas with different key order produce the same hash.
 */

import { Hash } from '../../../src/index.js';

const schemaA = {
  'properties': {
    'isbn': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'type': 'object'
};
const schemaB = {
  'properties': {
    'isbn': { 'type': 'string' },
    'title': { 'type': 'string' }
  },
  'type': 'object'
};

const hashA = Hash.value(schemaA);
const hashB = Hash.value(schemaB);

console.assert(hashA === hashB, 'key order does not matter');

// Use as a cache key
const cache = new Map<string, unknown>();
const key = Hash.value(schemaA);

if (!cache.has(key)) {
  cache.set(key, { 'computedResult': 'expensive computation' });
}
console.assert(cache.has(key), 'cache entry present');

console.log('Hash.value (structurally equal schemas):', hashA === hashB);
console.log('Cache key:', key);
console.log('Cache hit:', cache.has(key));
