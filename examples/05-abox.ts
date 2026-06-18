/**
 * 05-abox — ABox instance projection
 *
 * Demonstrates: projecting validated data to RDF instance quads (ABox).
 * Each instance becomes a JSON-LD node linked by class-scoped property IRIs.
 *
 * Run: npm run build && npx tsx examples/05-abox.ts
 */

import { JsonTology } from '../src/index.js';
import { DataType } from '../src/modules/data/DataType.js';

// ---------------------------------------------------------------------------
// Schema with nested object
// ---------------------------------------------------------------------------

const OrderSchema = {
  '$defs': {
    'ShippingAddress': {
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
  '$id': 'https://bookstore.example/schema/Order',
  'properties': {
    'orderId': { 'type': 'string' },
    'placedAt': {
      'format': 'date-time',
      'type': 'string'
    },
    'shippingAddress': { '$ref': '#/$defs/ShippingAddress' }
  },
  'required': [
    'orderId',
    'placedAt'
  ],
  'title': 'Order',
  'type': 'object'
} as const;

// ---------------------------------------------------------------------------
// Instance data
// ---------------------------------------------------------------------------

const order = {
  'orderId': 'ORD-20260614-0042',
  'placedAt': '2026-06-14T09:00:00Z',
  'shippingAddress': {
    'city': 'Berlin',
    'country': 'DE'
  }
};

// ---------------------------------------------------------------------------
// Project to ABox
// ---------------------------------------------------------------------------

// enableStrictGraph: false — self-contained demo with a nested inline $defs
// shape kept inline for brevity rather than extracted to its own $ref'd schema.
const jt = JsonTology.create({
  'baseIRI': 'https://bookstore.example',
  'enableStrictGraph': false,
  'schemas': [OrderSchema]
});

const validated = jt.instantiate(OrderSchema, order);
const abox = jt.toQuads(OrderSchema, validated);
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
  if (!DataType.isRecord(node)) {
    continue;
  }
  const id = node['@id'];
  const type = node['@type'];
  const typeId = DataType.isRecord(type) ? type['@id'] : type;

  console.log(`  Node: ${String(id)}`);
  console.log(`  Type: ${String(typeId)}`);

  for (const [
    key,
    value
  ] of Object.entries(node)) {
    if (key === '@id' || key === '@type') {
      continue;
    }
    const display = DataType.isRecord(value) ? JSON.stringify(value) : value;

    console.log(`    ${key}: ${String(display)}`);
  }
  console.log();
}
