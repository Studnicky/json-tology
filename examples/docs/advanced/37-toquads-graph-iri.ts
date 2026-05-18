/**
 * Set the named graph IRI for every emitted quad via the graphIRI option.
 *
 * Useful for partitioning quads into named graphs (e.g. monthly slices, or
 * a per-tenant graph) without rewriting subjects.
 */

import {
  aboxFixtures, bookstoreEntities, OrderSchema
} from '../bookstore/index.js';

const order = bookstoreEntities.instantiate(OrderSchema, aboxFixtures.order);

const quads = bookstoreEntities.toQuads(OrderSchema, order, { 'graphIRI': 'https://shop.example.com/graphs/2026-01' });

console.assert(quads.length > 0, 'quads emitted');
console.assert(
  quads.every((quad) => {
    return quad.graph.value === 'https://shop.example.com/graphs/2026-01';
  }),
  'every quad carries the configured named graph'
);
