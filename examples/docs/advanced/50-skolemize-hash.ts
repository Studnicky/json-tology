/**
 * Skolemize.hash — default-equivalent content-addressed minter.
 *
 * Hashes the value with FNV-1a and emits `<baseIRI>/instances/<hash>`.
 * Deterministic — equal values produce equal IRIs across calls and processes.
 */

import { Skolemize } from '../../../src/index.js';
import {
  aboxFixtures, bookstoreEntities, CustomerSchema
} from '../bookstore/index.js';

const quads = bookstoreEntities.toQuads(CustomerSchema, aboxFixtures.customer, { 'iriFor': Skolemize.hash({ 'baseIRI': 'https://shop.example.com' }) });

console.assert(quads.length > 0, 'hash-minted IRIs emit quads');
console.assert(
  quads.some((quad) => {
    return quad.subject.value.startsWith('https://shop.example.com/instances/');
  }),
  'hash-minted root carries the configured baseIRI prefix'
);
