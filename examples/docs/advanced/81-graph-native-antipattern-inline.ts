/**
 * Graph-native authoring anti-pattern — two inline ISBN shapes.
 *
 * When the same constrained shape is inlined in multiple schemas, the graph
 * sees them as two separate, unrelated nodes. The OWL output emits two
 * anonymous DatatypeProperty ranges. `findDuplicates()` flags the inline
 * shapes that match the named IsbnSchema as redundant.
 *
 * Demonstrates: inline duplication — findDuplicates returns the offending
 * pair; `equivalentTo` points at the named IsbnSchema.
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// The named canonical form — this should be the single source of truth
const IsbnSchemaCanonical = {
  '$id': 'urn:bookstore:IsbnCanonical',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

// BAD — two separate ISBN nodes in the graph, unrelated to each other
const BookInlineIsbn = {
  '$id': 'urn:bookstore:BookInline',
  'properties': {
    'isbn': {
      // node 1 — inline ISBN constraint, structurally identical to IsbnSchemaCanonical
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

registry.set(IsbnSchemaCanonical);
registry.set(BookInlineIsbn);
registry.set(OrderInlineIsbn);

// findDuplicates reveals inline shapes that match the named IsbnSchemaCanonical
const duplicates = registry.findDuplicates();

console.assert(
  duplicates.length > 0,
  'findDuplicates detects inline ISBN shapes matching the named canonical schema'
);
console.assert(
  duplicates.some((dup) => {
    return dup.equivalentTo === IsbnSchemaCanonical.$id;
  }),
  'duplicates point back to the named IsbnSchemaCanonical'
);

console.log('Anti-pattern: inline duplicate count:', duplicates.length, '| equivalent to:', duplicates[0]?.equivalentTo);
