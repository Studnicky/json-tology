/**
 * 03-ontology — OWL ontology generation
 *
 * Demonstrates: generating a JSON-LD ontology from schemas.
 * Classes, properties, domain/range, and cardinality restrictions
 * are all derived automatically from schema definitions.
 *
 * Run: npm run build && npx tsx examples/03-ontology.ts
 */

import { JsonTology } from '../src/index.js';
import { isRecord } from '../src/modules/data/DataTypes.js';

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
} as const;

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
} as const;

// ---------------------------------------------------------------------------
// Generate ontology
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with constrained primitives
// (format, minimum) kept inline for brevity rather than extracted to $ref'd schemas.
const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'enableStrictGraph': false,
  'schemas': [
    PersonSchema,
    OrganizationSchema
  ]
});

const ontology = jt.ontology();
const jsonLd = ontology.jsonLdObject();

console.log('--- OWL Ontology (JSON-LD) ---');
console.log(JSON.stringify(jsonLd, null, 2));
console.log();

// ---------------------------------------------------------------------------
// Inspect the graph contents
// ---------------------------------------------------------------------------

const rawGraph = jsonLd['@graph'];
const graph = Array.isArray(rawGraph) ? rawGraph : [];

const classes = graph.filter((n): n is Record<string, unknown> => {
  return isRecord(n) && n['@type'] === 'owl:Class';
});
const properties = graph.filter((n): n is Record<string, unknown> => {
  return isRecord(n) && (n['@type'] === 'owl:DatatypeProperty' || n['@type'] === 'owl:ObjectProperty');
});

console.log('--- Derived classes ---');
for (const cls of classes) {
  const label = isRecord(cls['rdfs:label']) ? String(cls['rdfs:label']) : cls['rdfs:label'];

  console.log(' ', cls['@id'], '-', label ?? '(no label)');
}
console.log();

console.log('--- Derived properties ---');
for (const prop of properties) {
  const domain = isRecord(prop['rdfs:domain']) ? prop['rdfs:domain']['@id'] : undefined;
  const range = isRecord(prop['rdfs:range']) ? prop['rdfs:range']['@id'] : undefined;

  console.log(`  ${String(prop['@id'])}  [${String(prop['@type'])}]`);
  console.log(`    domain: ${String(domain ?? '(none)')}  range: ${String(range ?? '(none)')}`);
}
