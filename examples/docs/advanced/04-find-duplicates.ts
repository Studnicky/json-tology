/**
 * Advanced Example 04 — SchemaRegistry.findDuplicates()
 * Demonstrates: detecting structurally-identical inline shapes
 */

import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

const IsbnSchema = {
  '$id': 'urn:bookstore:Isbn',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

// Book uses an inline ISBN shape instead of referencing IsbnSchema
const BookSchema = {
  '$id': 'urn:bookstore:BookWithInlineIsbn',
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

// enableStrictGraph: false — this example intentionally registers a schema
// with an inline duplicate shape to demonstrate findDuplicates() detection.
const registry = new SchemaRegistry({ 'enableStrictGraph': false });

registry.set(IsbnSchema);
registry.set(BookSchema);

const duplicates = registry.findDuplicates();

console.log(`Found ${duplicates.length} duplicate shape(s):`);

for (const dup of duplicates) {
  console.log(`  Schema: ${dup.schemaId}`);
  console.log(`  Pointer: ${dup.pointer}`);
  console.log(`  Equivalent to: ${dup.equivalentTo}`);
  console.log(`  Shape: ${JSON.stringify(dup.shape)}`);
  console.log('');
}
