/**
 * 05-abox.mjs — ABox instance projection
 *
 * Demonstrates: projecting validated data to RDF instance quads (ABox).
 * Each instance becomes a JSON-LD node linked by class-scoped property IRIs.
 *
 * Run: npm run build && node examples/05-abox.mjs
 */

import { JsonTology } from '../dist/index.js';

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
};

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

const jt = JsonTology.create({
  'baseIRI': 'https://example.com',
  'schemas': [EventSchema]
});

const abox = jt.abox(EventSchema, event);

console.log('--- ABox Instance (JSON-LD) ---');
const aboxJsonLdObj = abox.jsonLdObject();
const aboxJsonLd = JSON.stringify(aboxJsonLdObj, null, 2);

console.log(aboxJsonLd);
console.log();

// ---------------------------------------------------------------------------
// Inspect individual nodes
// ---------------------------------------------------------------------------

const nodes = abox.raw();

console.log('--- Instance nodes ---');
for (const node of nodes) {
  const id = node['@id'];
  const type = node['@type'];
  const typeId = typeof type === 'object' && type !== null ? type['@id'] : type;

  console.log(`  Node: ${id}`);
  console.log(`  Type: ${typeId}`);

  for (const [
    key,
    value
  ] of Object.entries(node)) {
    if (key === '@id' || key === '@type') {
      continue;
    }
    const display = typeof value === 'object' && value !== null
      ? JSON.stringify(value)
      : value;

    console.log(`    ${key}: ${display}`);
  }
  console.log();
}
