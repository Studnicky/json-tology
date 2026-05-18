/**
 * Loaders.compose — chain multiple loaders with first-non-null wins.
 *
 * `Loaders.compose` tries each loader in order and returns the first non-null
 * result. The fast path is an in-memory bundle of locally-known schemas;
 * the fallback is a network loader.
 *
 * Demonstrates: Loaders.compose + Loaders.memory + Loaders.fetch for a
 * "local-first, network-fallback" resolution strategy.
 */

import { Loaders } from '../../../src/index.js';
import {
  BookSchema,
  CustomerSchema,
  IsbnSchema
} from '../bookstore/index.js';

const composed = Loaders.compose(
  // Locally-known schemas served from memory — no network for known IRIs
  Loaders.memory(new Map([
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
  ])),
  // Fallback for IRIs not in the local bundle
  Loaders.fetch({ 'base': 'https://schemas.example/v1/' })
);

// The composed loader resolves from memory — no network needed for known IRIs
const customer = await composed(CustomerSchema.$id);

console.assert(customer !== null, 'composed loader resolves known IRI from memory');
console.assert(
  (customer as Record<string, string>).$id === CustomerSchema.$id,
  'resolved schema is the CustomerSchema'
);
