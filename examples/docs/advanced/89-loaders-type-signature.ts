/**
 * LoaderInterface — the loader function signature for JsonTology.prefetch.
 *
 * A loader is any async function that takes an IRI string and returns either
 * the schema object or `null` (IRI unknown). This is the only type required
 * to implement a custom loader.
 *
 * `Loaders.fetch`, `Loaders.memory`, `Loaders.compose`, and `Loaders.cached`
 * all return functions conforming to this signature.
 *
 * Demonstrates: the LoaderInterface contract — returns the schema for known IRIs,
 * null for unknown IRIs, never throws for expected misses.
 */

import { Loaders } from '../../../src/index.js';
import type { JsonSchemaType } from '../../../src/types/Schema.js';
import {
  BookSchema,
  CustomerSchema
} from '../bookstore/index.js';

// Loaders.memory returns a LoaderInterface — callable with (iri: string)
const loader = Loaders.memory(new Map<string, JsonSchemaType>([
  [
    BookSchema.$id,
    BookSchema
  ],
  [
    CustomerSchema.$id,
    CustomerSchema
  ]
]));

// Returns the schema for known IRIs
const resolved = await loader(CustomerSchema.$id);

console.assert(resolved !== null, 'known IRI returns schema (not null)');
console.assert(typeof resolved === 'object', 'resolved schema is an object');

// Returns null for unknown IRIs — no throw
const unknown = await loader('urn:bookstore:Unknown');

console.assert(unknown === null, 'unknown IRI returns null per LoaderInterface contract');

console.log('LoaderInterface: resolved schema $id:', (resolved as Record<string, string>).$id, '| unknown IRI returns null:', unknown === null);
