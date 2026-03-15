/**
 * 04-shacl.mjs — SHACL shapes generation
 *
 * Demonstrates: generating SHACL shapes from schemas for RDF validation.
 * Constraint predicates (sh:minLength, sh:pattern, sh:minInclusive, etc.)
 * are derived from JSON Schema keywords.
 *
 * Run: npm run build && node examples/04-shacl.mjs
 */

import { JsonTology } from '../dist/index.js';

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
      'maximum': 999999,
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
};

// ---------------------------------------------------------------------------
// Generate SHACL shapes
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'schemas': [ProductSchema]
});

const shacl = jt.ontology().shaclObject();

console.log('--- SHACL Shapes (JSON-LD) ---');
const shaclStr = JSON.stringify(shacl, null, 2);

console.log(shaclStr);
console.log();

// ---------------------------------------------------------------------------
// Inspect the shapes
// ---------------------------------------------------------------------------

const shapes = shacl['@graph'];

if (Array.isArray(shapes)) {
  for (const shape of shapes) {
    if (shape['@type'] === 'sh:NodeShape') {
      console.log(`--- NodeShape: ${shape['@id']} ---`);
      const props = shape['sh:property'];

      if (Array.isArray(props)) {
        for (const prop of props) {
          const path = prop['sh:path']?.['@id'] || '(unknown)';

          console.log(`  Property: ${path}`);
          if (prop['sh:datatype']) {
            console.log(`    sh:datatype:      ${prop['sh:datatype']['@id']}`);
          }
          if (prop['sh:minCount'] !== undefined) {
            console.log(`    sh:minCount:      ${prop['sh:minCount']}`);
          }
          if (prop['sh:maxCount'] !== undefined) {
            console.log(`    sh:maxCount:      ${prop['sh:maxCount']}`);
          }
          if (prop['sh:minLength'] !== undefined) {
            console.log(`    sh:minLength:     ${prop['sh:minLength']}`);
          }
          if (prop['sh:minInclusive'] !== undefined) {
            console.log(`    sh:minInclusive:  ${prop['sh:minInclusive']}`);
          }
          if (prop['sh:maxInclusive'] !== undefined) {
            console.log(`    sh:maxInclusive:  ${prop['sh:maxInclusive']}`);
          }
          if (prop['sh:pattern']) {
            console.log(`    sh:pattern:       ${prop['sh:pattern']}`);
          }
        }
      }
    }
  }
}
