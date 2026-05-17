/**
 * Hash: deterministic FNV-1a hash of JSON values
 *
 * Hash.value returns a hex FNV-1a hash. Object keys are sorted before
 * serialization, so key order does not matter.
 */

import { Hash } from 'json-tology';

const schemaA = {
  'isbn': '9780140449136',
  'title': 'War and Peace'
};
const schemaB = {
  'isbn': '9780140449136',
  'title': 'War and Peace'
};

const hashA = Hash.value(schemaA);
const hashB = Hash.value(schemaB);

console.assert(hashA === hashB, 'key order does not matter');
console.assert(typeof hashA === 'string', 'hash is string');

// Use as a cache key
const cache = new Map<string, unknown>();
const key = Hash.value(schemaA);

if (!cache.has(key)) {
  cache.set(key, { 'computed': true });
}
console.assert(cache.has(key), 'cache keyed by hash');
