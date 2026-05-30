/**
 * 05-abox — ABox instance projection
 *
 * Demonstrates: projecting validated data to RDF instance quads (ABox).
 * Each instance becomes a JSON-LD node linked by class-scoped property IRIs.
 *
 * Run: npm run build && npx tsx examples/05-abox.ts
 */

import { JsonTology } from '../src/index.js';
import { isRecord } from '../src/modules/data/DataTypes.js';

// ---------------------------------------------------------------------------
// Schema with nested object
// ---------------------------------------------------------------------------

const EventSchema = {
  '$defs': {
    'Location': {
      'properties': {
        'city': { 'type': 'string' },
        'country': { 'type': 'string' }
      },
      'required': [
        'city',
        'country'
      ],
      'type': 'object'
    }
  },
  '$id': 'https://example.com/Event',
  'properties': {
    'date': {
      'format': 'date-time',
      'type': 'string'
    },
    'location': { '$ref': '#/$defs/Location' },
    'title': { 'type': 'string' }
  },
  'required': [
    'title',
    'date'
  ],
  'title': 'Event',
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Instance data
// ---------------------------------------------------------------------------

const event = {
  'date': '2026-06-15T09:00:00Z',
  'location': {
    'city': 'Berlin',
    'country': 'DE'
  },
  'title': 'JSON-LD Workshop'
};

// ---------------------------------------------------------------------------
// Project to ABox
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with a nested inline $defs
// shape kept inline for brevity rather than extracted to its own $ref'd schema.
const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'enableStrictGraph': false,
  'schemas': [EventSchema]
});

const validated = jt.instantiate(EventSchema, event);
const abox = jt.toQuads(EventSchema, validated);
const aboxBuilder = jt.ontology().addFromQuads(abox);

console.log('--- ABox Instance (JSON-LD) ---');
const aboxJsonLdObj = aboxBuilder.jsonLdObject();

console.log(JSON.stringify(aboxJsonLdObj, null, 2));
console.log();

// ---------------------------------------------------------------------------
// Inspect individual nodes
// ---------------------------------------------------------------------------

const rawNodes = aboxJsonLdObj['@graph'];
const nodes = Array.isArray(rawNodes) ? rawNodes : [];

console.log('--- Instance nodes ---');
for (const node of nodes) {
  if (!isRecord(node)) {
    continue;
  }
  const id = node['@id'];
  const type = node['@type'];
  const typeId = isRecord(type) ? type['@id'] : type;

  console.log(`  Node: ${String(id)}`);
  console.log(`  Type: ${String(typeId)}`);

  for (const [
    key,
    value
  ] of Object.entries(node)) {
    if (key === '@id' || key === '@type') {
      continue;
    }
    const display = isRecord(value) ? JSON.stringify(value) : value;

    console.log(`    ${key}: ${String(display)}`);
  }
  console.log();
}
