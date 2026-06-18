/**
 * 04-shacl — SHACL shapes generation
 *
 * Demonstrates: generating SHACL shapes from schemas for RDF validation.
 * Constraint predicates (sh:minLength, sh:pattern, sh:minInclusive, etc.)
 * are derived from JSON Schema keywords.
 *
 * Run: npm run build && npx tsx examples/04-shacl.ts
 */

import { JsonTology } from '../src/index.js';
import { DataType } from '../src/modules/data/DataType.js';

// ---------------------------------------------------------------------------
// Schema with constraints
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'https://bookstore.example/schema/Book',
  'properties': {
    'isbn': {
      'minLength': 10,
      'pattern': '^(?:97[89]-)?\\d{1,5}-\\d+-\\d+-\\d$',
      'type': 'string'
    },
    'price': {
      'maximum': 9999.99,
      'minimum': 0,
      'type': 'number'
    },
    'stockLevel': {
      'minimum': 0,
      'type': 'integer'
    },
    'title': {
      'minLength': 1,
      'type': 'string'
    }
  },
  'required': [
    'isbn',
    'title',
    'price'
  ],
  'title': 'Book',
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Generate SHACL shapes
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with constrained primitives
// (minLength, pattern, minimum) kept inline for brevity rather than extracted to $ref'd schemas.
const jt = JsonTology.create({
  'baseIri': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [BookSchema]
});

const shacl = jt.ontology().shaclObject();

console.log('--- SHACL Shapes (JSON-LD) ---');
console.log(JSON.stringify(shacl, null, 2));
console.log();

// ---------------------------------------------------------------------------
// Inspect the shapes
// ---------------------------------------------------------------------------

const rawShapes = shacl['@graph'];
const shapes = Array.isArray(rawShapes) ? rawShapes : [];

for (const shape of shapes) {
  if (!DataType.isRecord(shape) || shape['@type'] !== 'sh:NodeShape') {
    continue;
  }
  console.log(`--- NodeShape: ${String(shape['@id'])} ---`);
  const rawProps = shape['sh:property'];
  const props = Array.isArray(rawProps) ? rawProps : [];

  for (const prop of props) {
    if (!DataType.isRecord(prop)) {
      continue;
    }
    const pathNode = prop['sh:path'];
    const path = DataType.isRecord(pathNode) ? String(pathNode['@id'] ?? '(unknown)') : '(unknown)';

    console.log(`  Property: ${path}`);
    const datatypeNode = prop['sh:datatype'];

    if (DataType.isRecord(datatypeNode)) {
      console.log(`    sh:datatype:      ${String(datatypeNode['@id'])}`);
    }
    if (prop['sh:minCount'] !== undefined) {
      console.log(`    sh:minCount:      ${String(prop['sh:minCount'])}`);
    }
    if (prop['sh:maxCount'] !== undefined) {
      console.log(`    sh:maxCount:      ${String(prop['sh:maxCount'])}`);
    }
    if (prop['sh:minLength'] !== undefined) {
      console.log(`    sh:minLength:     ${String(prop['sh:minLength'])}`);
    }
    if (prop['sh:minInclusive'] !== undefined) {
      console.log(`    sh:minInclusive:  ${String(prop['sh:minInclusive'])}`);
    }
    if (prop['sh:maxInclusive'] !== undefined) {
      console.log(`    sh:maxInclusive:  ${String(prop['sh:maxInclusive'])}`);
    }
    if (prop['sh:pattern'] !== undefined) {
      console.log(`    sh:pattern:       ${String(prop['sh:pattern'])}`);
    }
  }
}
