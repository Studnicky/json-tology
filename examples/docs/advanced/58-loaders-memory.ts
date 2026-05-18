/**
 * Loaders.memory — in-memory loader for local schema bundles.
 *
 * `Loaders.memory` accepts a `Map` or plain object keyed by $id IRI. It
 * returns a `LoaderType` that resolves schemas with zero I/O — useful for
 * pre-bundled schemas at build time and for testing.
 *
 * Demonstrates: Loaders.memory with bookstore schemas as the lookup map.
 */

import { Loaders } from '../../../src/index.js';
import {
  BookSchema,
  CustomerSchema,
  IsbnSchema
} from '../bookstore/index.js';

// Build an in-memory Map keyed by $id IRI — Map avoids the index-signature cast
const memLoader = Loaders.memory(new Map([
  [
    BookSchema.$id,
    BookSchema
  ],
  [
    CustomerSchema.$id,
    CustomerSchema
  ],
  [
    IsbnSchema.$id,
    IsbnSchema
  ]
]));

// Resolve a known IRI — returns the schema
const resolved = await memLoader(CustomerSchema.$id);

console.assert(resolved !== null, 'known IRI resolves from memory');
console.assert(
  (resolved as Record<string, string>).$id === CustomerSchema.$id,
  'resolved schema carries the expected $id'
);

// Resolve an unknown IRI — returns null (no throw)
const unknown = await memLoader('urn:bookstore:NoSuchSchema');

console.assert(unknown === null, 'unknown IRI returns null');
