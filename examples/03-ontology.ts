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

const AuthorSchema = {
  '$id': 'https://bookstore.example/schema/Author',
  'description': 'A book author',
  'properties': {
    'biography': { 'type': 'string' },
    'name': { 'type': 'string' },
    'publishedBy': { '$ref': 'https://bookstore.example/schema/Publisher' }
  },
  'required': ['name'],
  'title': 'Author',
  'type': 'object'
} as const;

const PublisherSchema = {
  '$id': 'https://bookstore.example/schema/Publisher',
  'description': 'A book publisher',
  'properties': {
    'authors': {
      'items': { '$ref': 'https://bookstore.example/schema/Author' },
      'type': 'array'
    },
    'founded': {
      'minimum': 1400,
      'type': 'integer'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'title': 'Publisher',
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Generate ontology
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with constrained primitives
// (minimum) kept inline for brevity rather than extracted to $ref'd schemas.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [
    AuthorSchema,
    PublisherSchema
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
