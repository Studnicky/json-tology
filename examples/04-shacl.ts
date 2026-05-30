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
import { isRecord } from '../src/modules/data/DataTypes.js';

// ---------------------------------------------------------------------------
// Schema with constraints
// ---------------------------------------------------------------------------

const ProductSchema = {
  '$id': 'https://example.com/Product',
  'properties': {
    'name': {
      'minLength': 1,
      'type': 'string'
    },
    'price': {
      'maximum': 999_999,
      'minimum': 0,
      'type': 'number'
    },
    'quantity': {
      'minimum': 0,
      'type': 'integer'
    },
    'sku': {
      'minLength': 3,
      'pattern': '^[A-Z]{2,}-\\d+$',
      'type': 'string'
    }
  },
  'required': [
    'sku',
    'name',
    'price'
  ],
  'title': 'Product',
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Generate SHACL shapes
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with constrained primitives
// (minLength, pattern, minimum) kept inline for brevity rather than extracted to $ref'd schemas.
const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'enableStrictGraph': false,
  'schemas': [ProductSchema]
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
  if (!isRecord(shape) || shape['@type'] !== 'sh:NodeShape') {
    continue;
  }
  console.log(`--- NodeShape: ${String(shape['@id'])} ---`);
  const rawProps = shape['sh:property'];
  const props = Array.isArray(rawProps) ? rawProps : [];

  for (const prop of props) {
    if (!isRecord(prop)) {
      continue;
    }
    const pathNode = prop['sh:path'];
    const path = isRecord(pathNode) ? String(pathNode['@id'] ?? '(unknown)') : '(unknown)';

    console.log(`  Property: ${path}`);
    const datatypeNode = prop['sh:datatype'];

    if (isRecord(datatypeNode)) {
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
