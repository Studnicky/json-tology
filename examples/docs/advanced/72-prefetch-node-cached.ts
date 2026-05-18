/**
 * Node pattern — prefetch with Loaders.cached wrapping Loaders.memory.
 *
 * The same `JsonTology.prefetch` + `create` pattern works identically in Node,
 * Bun, Deno, and browsers. Wrapping the loader with `Loaders.cached` prevents
 * re-fetching the same IRI if `prefetch` is called again (e.g., after a hot
 * reload or a second call with an expanded schema list).
 *
 * The memory loader is seeded from the canonical `bookstoreSchemas` array so
 * every transitive `$ref` (Email, Address, CityName, …) resolves locally.
 *
 * Demonstrates: Loaders.cached wrapping Loaders.memory; prefetch + synchronous
 * create against the canonical bookstore.
 */

import {
  JsonTology,
  Loaders
} from '../../../src/index.js';
import {
  bookstoreSchemas,
  CustomerSchema
} from '../bookstore/index.js';

const memoryLoader = Loaders.memory(new Map(bookstoreSchemas.map((schema) => {
  return [
    schema.$id,
    schema
  ] as const;
})));

const snapshot = await JsonTology.prefetch({
  'loader': Loaders.cached(memoryLoader),
  'schemas': [CustomerSchema]
});

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'prefetched': snapshot,
  'schemas': [CustomerSchema] as const
});

// Synchronous validate after async prefetch
const valid = jt.validate(CustomerSchema.$id, {
  'addresses': [],
  'email': 'cornelia.funke@bookstore.example',
  'id': 'a1b2c3d4-0000-1111-2222-333344445555',
  'name': 'Cornelia Funke'
});

console.assert(typeof valid === 'object', 'validate result is an object');
