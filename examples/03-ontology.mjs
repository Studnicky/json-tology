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
  $id: 'https://example.com/Person',
  title: 'Person',
  description: 'A human being',
  type: 'object',
  properties: {
    name:  { type: 'string' },
    email: { type: 'string', format: 'email' },
    worksFor: { $ref: 'https://example.com/Organization' },
  },
  required: ['name'],
};

const OrganizationSchema = {
  $id: 'https://example.com/Organization',
  title: 'Organization',
  description: 'A company or institution',
  type: 'object',
  properties: {
    name:    { type: 'string' },
    founded: { type: 'integer', minimum: 1800 },
    members: {
      type: 'array',
      items: { $ref: 'https://example.com/Person' },
    },
  },
  required: ['name'],
};

// ---------------------------------------------------------------------------
// Generate ontology
// ---------------------------------------------------------------------------

const jt = JsonTology.create({
  baseIRI: 'https://example.com',
  schemas: [PersonSchema, OrganizationSchema],
});

const ontology = jt.ontology();
const jsonLd = ontology.jsonLdObject();

console.log('--- OWL Ontology (JSON-LD) ---');
console.log(JSON.stringify(jsonLd, null, 2));
console.log();

// ---------------------------------------------------------------------------
// Inspect the graph contents
// ---------------------------------------------------------------------------

const graph = ontology.raw();
const classes = graph.filter(n => n['@type'] === 'owl:Class');
const properties = graph.filter(n =>
  n['@type'] === 'owl:DatatypeProperty' || n['@type'] === 'owl:ObjectProperty'
);

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
