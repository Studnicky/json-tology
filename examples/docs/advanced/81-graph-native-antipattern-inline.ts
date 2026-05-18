/**
 * Graph-native authoring anti-pattern — two inline ISBN shapes.
 *
 * When the same constrained shape is inlined in multiple schemas, the graph
 * sees them as two separate, unrelated nodes. The OWL output emits two
 * anonymous DatatypeProperty ranges. `findDuplicates()` flags the pair.
 *
 * Demonstrates: inline duplication — findDuplicates returns the offending
 * pair; `equivalentTo` points at the first occurrence.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// BAD — two separate ISBN nodes in the graph, unrelated to each other
const BookInlineIsbn = {
  '$id': 'urn:bookstore:BookInline',
  'properties': {
    'isbn': {
      // node 1 — inline ISBN constraint
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

const OrderInlineIsbn = {
  '$id': 'urn:bookstore:OrderInline',
  'properties': {
    'isbn': {
      // node 2 — structurally identical but unrelated in the graph
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'quantity': { 'type': 'integer' }
  },
  'type': 'object'
} as const;

// enableStrictGraph: false — this example intentionally registers schemas
// with inline duplicate shapes to demonstrate findDuplicates() detection.
const registry = new SchemaRegistry({ 'enableStrictGraph': false });

registry.set(BookInlineIsbn);
registry.set(OrderInlineIsbn);

// findDuplicates reveals the two inline ISBN shapes as redundant
const duplicates = registry.findDuplicates();

console.assert(
  duplicates.length > 0,
  'findDuplicates detects structurally identical inline ISBN shapes'
);
console.assert(
  duplicates.some((dup) => {
    return dup.schemaId === OrderInlineIsbn.$id || dup.schemaId === BookInlineIsbn.$id;
  }),
  'at least one duplicate is attributed to an inline schema'
);
