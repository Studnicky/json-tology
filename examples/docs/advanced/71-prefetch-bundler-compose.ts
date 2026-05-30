/**
 * Bundler pattern — pre-bundle local schemas with network fallback.
 *
 * In a bundler context (Vite, esbuild, webpack), local schemas are imported
 * at build time and seeded into `Loaders.memory`. A `Loaders.compose` chain
 * tries memory first; for any IRI not in the bundle the chain falls back to
 * the next loader (here a stub that returns null so the example runs
 * deterministically offline — in production this slot carries
 * `Loaders.fetch({ base: '…' })`).
 *
 * Demonstrates: Loaders.compose + Loaders.memory seeded from the canonical
 * bookstore schema set + prefetch + synchronous create.
 */

import {
  JsonTology,
  Loaders
} from '../../../src/index.js';
import {
  bookstoreSchemas,
  CustomerSchema,
  OrderSchema
} from '../bookstore/index.js';

// Network-fallback stub — in production replace with
// `Loaders.fetch({ base: 'https://schemas.example/v1/' })`. Returning null
// lets `Loaders.compose` move on to the next loader (none here) and keeps
// the example runnable in offline test environments.
const offlineFallback = (): Promise<null> => {
  return Promise.resolve(null);
};

const snapshot = await JsonTology.prefetch({
  'loader': Loaders.compose(
    // Pre-bundled schemas — memory fast path, no network for known IRIs.
    Loaders.memory(new Map(bookstoreSchemas.map((schema) => {
      return [
        schema.$id,
        schema
      ] as const;
    }))),
    offlineFallback
  ),
  'schemas': [
    CustomerSchema,
    OrderSchema
  ]
});

const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'prefetched': snapshot,
  'schemas': [
    CustomerSchema,
    OrderSchema
  ] as const
});

// validate is synchronous — async work was isolated to prefetch
const result = jt.validate(CustomerSchema.$id, {
  'addresses': [],
  'customerId': 'c1a2b3d4-e5f6-7890-abcd-ef1234567890',
  'email': 'bastian.bux@bookstore.example',
  'name': 'Bastian Balthazar Bux'
});

console.assert(result.ok, 'Customer validates against prefetched registry');

console.log('Prefetch + sync create: snapshot schemas:', snapshot.schemas.size, '| validate ok:', result.ok);
