/**
 * 03-ontology.mjs — OWL ontology generation
 *
 * Demonstrates: generating a JSON-LD ontology from schemas.
 * Classes, properties, domain/range, and cardinality restrictions
 * are all derived automatically from schema definitions.
 *
 * Run: npm run build && node examples/03-ontology.mjs
 */

import { JsonTology } from '../dist/index.js';

// ---------------------------------------------------------------------------
// Schemas with $ref relationships
// ---------------------------------------------------------------------------

const PersonSchema = {
  '$id': 'https://example.com/Person',
  'description': 'A human being',
  'properties': {
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'name': { 'type': 'string' },
    'worksFor': { '$ref': 'https://example.com/Organization' }
  },
  'required': ['name'],
  'title': 'Person',
  'type': 'object'
};

const OrganizationSchema = {
  '$id': 'https://example.com/Organization',
  'description': 'A company or institution',
  'properties': {
    'founded': {
      'minimum': 1800,
      'type': 'integer'
    },
    'members': {
      'items': { '$ref': 'https://example.com/Person' },
      'type': 'array'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'title': 'Organization',
  'type': 'object'
};

// ---------------------------------------------------------------------------
// Generate ontology
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'schemas': [
    PersonSchema,
    OrganizationSchema
  ]
});

const ontology = jt.ontology();
const jsonLd = ontology.jsonLdObject();

console.log('--- OWL Ontology (JSON-LD) ---');
const jsonLdStr = JSON.stringify(jsonLd, null, 2);

console.log(jsonLdStr);
console.log();

// ---------------------------------------------------------------------------
// Inspect the graph contents
// ---------------------------------------------------------------------------

const graph = ontology.jsonLdObject()['@graph'];
const classes = graph.filter((n) => {
  return n['@type'] === 'owl:Class';
});
const properties = graph.filter((n) => {
  return n['@type'] === 'owl:DatatypeProperty' || n['@type'] === 'owl:ObjectProperty';
});

console.log('--- Derived classes ---');
for (const cls of classes) {
  console.log(' ', cls['@id'], '-', cls['rdfs:label'] || '(no label)');
}
console.log();

console.log('--- Derived properties ---');
for (const prop of properties) {
  const domain = prop['rdfs:domain']?.['@id'] || '(none)';
  const range = prop['rdfs:range']?.['@id'] || '(none)';

  console.log(`  ${prop['@id']}  [${prop['@type']}]`);
  console.log(`    domain: ${domain}  range: ${range}`);
}
