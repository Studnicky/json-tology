/**
 * Custom in-memory loader — resolve schemas from a pre-built map.
 *
 * Any function with signature `(iri: string) => Promise<JsonSchemaType | null>`
 * is a valid loader. This example builds a small in-memory map of schema IRI
 * to schema object and a loader function that resolves from it — no disk I/O,
 * no Node built-ins, runs identically in browsers, workers, and Node.
 *
 * In a real setup the map would be populated from a bundled import or a prior
 * fetch; here we use the bookstore schemas directly so the example is
 * self-contained and verifiable.
 *
 * Demonstrates: custom loader function, `null` on miss, in-memory pattern.
 */

import {
  CustomerSchema,
  IsbnSchema
} from '../bookstore/index.js';

/** In-memory schema store keyed by schema $id. */
const schemaMap = new Map<string, Record<string, unknown>>([
  [
    CustomerSchema.$id,
    CustomerSchema
  ],
  [
    IsbnSchema.$id,
    IsbnSchema
  ]
]);

/**
 * Loader: resolves a schema IRI from the in-memory map.
 * Returns `null` for IRIs that have no registered entry.
 */
const memoryLoader = async (iri: string): Promise<null | Record<string, unknown>> => {
  return schemaMap.get(iri) ?? null;
};

// Loader resolves a known schema IRI
const customerResult = await memoryLoader(CustomerSchema.$id);

console.assert(customerResult !== null, 'known schema IRI resolves via memory loader');
console.assert(
  customerResult !== null && customerResult.$id === CustomerSchema.$id,
  'resolved schema carries correct $id'
);
console.log('customerResult.$id:', customerResult?.$id);

// IsbnSchema also resolves
const isbnResult = await memoryLoader(IsbnSchema.$id);

console.assert(isbnResult !== null, 'Isbn schema resolves from map');
console.log('isbnResult.$id:', isbnResult?.$id);

// Unknown IRI returns null without throwing
const unknown = await memoryLoader('urn:bookstore:NoSuchThing');

console.assert(unknown === null, 'unknown IRI returns null');
console.log('unknown IRI returns null:', unknown === null);
