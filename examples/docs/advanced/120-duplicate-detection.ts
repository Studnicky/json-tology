/**
 * Duplicate detection — runnable example
 * Demonstrates two observable detection modes:
 *
 *   1. Default strict-graph mode: throws SCHEMA_STRUCTURE_INVALID when an
 *      inline anonymous sub-shape is encountered. Inline shapes require $ref —
 *      extract the shape to a named schema with a $id.
 *
 *   2. enableStrictGraph: false — accepts the registration silently; findDuplicates()
 *      returns the (schemaId, pointer, equivalentTo, shape) report for the caller
 *      to act on (e.g. as a CI gate: log duplicates and exit non-zero).
 *
 * Scenario: IsbnSchema is the canonical named primitive for 13-digit ISBN strings.
 * BookWithInlineIsbn inlines the same constraint as a property shape instead of
 * using a $ref. Both detection modes surface this structural coincidence.
 */

import { JsonTology } from '../../../src/index.js';
import { SchemaRegistry } from '../../../src/modules/registry/SchemaRegistry.js';

// The canonical named ISBN primitive.
const IsbnSchema = {
  '$id': 'urn:bookstore:DupDetectionIsbn',
  'pattern': '^\\d{13}$',
  'type': 'string'
} as const;

// A book schema that inlines the same ISBN constraint instead of $ref-ing IsbnSchema.
// The inline property shape `{ pattern: '^\\d{13}$', type: 'string' }` is
// structurally identical to IsbnSchema — this is the duplicate.
const BookWithInlineIsbn = {
  '$id': 'urn:bookstore:DupDetectionBook',
  'properties': {
    'isbn': {
      'pattern': '^\\d{13}$',
      'type': 'string'
    },
    'title': { 'type': 'string' }
  },
  'type': 'object'
} as const;

// Mode 1: Default strict-graph mode throws SCHEMA_STRUCTURE_INVALID.
// Strict graph rejects inline shapes regardless of whether they duplicate a
// named schema — the intent is to keep every constrained primitive as a $ref.
let strictModeThrew = false;

try {
  JsonTology.create({
    'baseIRI': 'https://bookstore.example',
    'schemas': [
      IsbnSchema,
      BookWithInlineIsbn
    ] as const
  });
} catch (error) {
  const schemaErr = error as { 'code'?: string };

  strictModeThrew = schemaErr.code === 'SCHEMA_STRUCTURE_INVALID';
}

console.assert(
  strictModeThrew,
  'strict-graph mode throws SCHEMA_STRUCTURE_INVALID for inline primitive shapes'
);

// Mode 2: permissive mode accepts the registration; findDuplicates() reports the pair.
// Use this in CI to detect structural coincidence without blocking development:
//   if (registry.findDuplicates().length > 0) process.exit(1)
const registry = new SchemaRegistry({ 'enableStrictGraph': false });

registry.set(IsbnSchema);
registry.set(BookWithInlineIsbn);

const duplicates = registry.findDuplicates();

console.assert(duplicates.length > 0, 'findDuplicates returns at least one duplicate entry');

const entry = duplicates[0];

console.assert(
  entry.schemaId === BookWithInlineIsbn.$id,
  'entry.schemaId is the schema containing the duplicate inline shape'
);
console.assert(
  typeof entry.pointer === 'string',
  'entry.pointer is a JSON pointer to the inline shape within schemaId'
);
console.assert(
  entry.equivalentTo === IsbnSchema.$id,
  'entry.equivalentTo points to the uniquely-authoritative named IsbnSchema'
);
// entry.shape is the raw inline sub-schema object (always present on the
// DuplicateReportEntryType — confirmed non-nullable by the type system).
void entry.shape;

console.log(
  'SCHEMA_STRUCTURE_INVALID (strict):',
  strictModeThrew,
  '| findDuplicates length:',
  duplicates.length,
  '| schemaId:',
  entry.schemaId,
  '| pointer:',
  entry.pointer,
  '| equivalentTo:',
  entry.equivalentTo
);
