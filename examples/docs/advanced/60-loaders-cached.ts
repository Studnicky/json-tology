/**
 * Loaders.cached — LRU-cached loader wrapper.
 *
 * `Loaders.cached` wraps any loader and caches both resolved schemas and `null`
 * results so the inner loader is called at most once per IRI. Both positive and
 * negative results are cached (negative caching avoids repeated failed fetches).
 *
 * Demonstrates: Loaders.cached wrapping Loaders.memory, with custom maxSize.
 */

import { Loaders } from '../../../src/index.js';
import type { JsonSchemaType } from '../../../src/types/Schema.js';
import {
  BookSchema,
  CustomerSchema
} from '../bookstore/index.js';

const inner = Loaders.memory(new Map<string, JsonSchemaType>([
  [
    BookSchema.$id,
    BookSchema
  ],
  [
    CustomerSchema.$id,
    CustomerSchema
  ]
]));

// Wrap with a small LRU cache (256 entries)
const cached = Loaders.cached(inner, { 'maxSize': 256 });

// First call populates the cache
const first = await cached(CustomerSchema.$id);

console.assert(first !== null, 'first call resolves');

// Second call returns from cache — inner loader not called again
const second = await cached(CustomerSchema.$id);

console.assert(
  (second as Record<string, string>).$id === CustomerSchema.$id,
  'cached result carries the same $id'
);

// Null results are also cached
const miss = await cached('urn:bookstore:NoSuchSchema');

console.assert(miss === null, 'unknown IRI returns null');
