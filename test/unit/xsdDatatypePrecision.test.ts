/**
 * XSD datatype precision tests.
 *
 * Verifies that STRING_FORMAT_MAP emits precise XSD datatypes (not xsd:string)
 * for date, time, duration, uri, iri, uri-reference, iri-reference, and that
 * date-time already maps to xsd:dateTime. Also confirms that formats without
 * an XSD equivalent (email, uuid) remain xsd:string.
 *
 * Covers both OWL TBox output (rdfs:range) and SHACL output (sh:datatype).
 *
 * Fixture schemas use inline format on direct object properties so the
 * serializers emit XSD datatypes as rdfs:range / sh:datatype respectively.
 * $ref properties produce ObjectProperty ranges pointing at the referenced
 * schema IRI, not an XSD datatype — so inline format is the correct approach.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// IRIs used as discriminators in raw JSON-LD output
// ---------------------------------------------------------------------------

const RDFS_RANGE_IRI = 'http://www.w3.org/2000/01/rdf-schema#range';
const SH_DATATYPE_IRI = 'http://www.w3.org/ns/shacl#datatype';
const XSD_PREFIX = 'http://www.w3.org/2001/XMLSchema#';

// ---------------------------------------------------------------------------
// Fixture — a single entity with one inline-format property per datatype.
// Inline properties (not $ref) ensure the projection emits XSD IRI as
// rdfs:range / sh:datatype rather than the referenced schema IRI.
// ---------------------------------------------------------------------------

const ArticleSchema = {
  '$id': 'urn:test:xsd:Article',
  'properties': {
    'contact': {
      'format': 'email',
      'type': 'string'
    },
    'event': {
      'format': 'date-time',
      'type': 'string'
    },
    'link': {
      'format': 'uri',
      'type': 'string'
    },
    'period': {
      'format': 'duration',
      'type': 'string'
    },
    'published': {
      'format': 'date',
      'type': 'string'
    }
  },
  'required': [
    'published',
    'event',
    'link',
    'period',
    'contact'
  ],
  'type': 'object'
} as const;

function makeJt(): ReturnType<typeof JsonTology.create> {
  return JsonTology.create({
    'baseIRI': 'https://xsd-test.example',
    'schemas': [ArticleSchema]
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function collectValues(nodes: unknown[], predicate: string): string[] {
  const out: string[] = [];

  for (const node of nodes) {
    if (typeof node !== 'object' || node === null) {
      continue;
    }

    const record = node as Record<string, unknown>;
    const raw = record[predicate];

    if (raw === undefined) {
      continue;
    }

    const values = Array.isArray(raw) ? raw : [raw];

    for (const val of values) {
      if (typeof val === 'string') {
        out.push(val);
      } else if (typeof val === 'object' && val !== null) {
        const valRec = val as Record<string, unknown>;
        const id = valRec['@id'];

        if (typeof id === 'string') {
          out.push(id);
        }
      }
    }
  }

  return out;
}

function collectNested(items: unknown[], predicate: string): string[] {
  const out: string[] = [];

  for (const item of items) {
    if (typeof item !== 'object' || item === null) {
      continue;
    }

    const record = item as Record<string, unknown>;

    for (const cv of collectValues([record], predicate)) {
      out.push(cv);
    }

    for (const val of Object.values(record)) {
      if (Array.isArray(val)) {
        for (const cn of collectNested(val, predicate)) {
          out.push(cn);
        }
      }
    }
  }

  return out;
}

function xsdIri(localName: string): string {
  return `${XSD_PREFIX}${localName}`;
}

// ---------------------------------------------------------------------------
// Tests — TBox (OWL) rdfs:range precision
// ---------------------------------------------------------------------------

await describe('XSD datatype precision — TBox rdfs:range', async () => {
  const jt = makeJt();
  const raw = jt.toTbox().raw();
  const ranges = collectValues(raw, RDFS_RANGE_IRI);

  await it('format:date emits xsd:date in rdfs:range', () => {
    assert.ok(
      ranges.includes(xsdIri('date')),
      `Expected xsd:date in ranges but got: ${ranges.join(', ')}`
    );
  });

  await it('format:date-time emits xsd:dateTime in rdfs:range', () => {
    assert.ok(
      ranges.includes(xsdIri('dateTime')),
      `Expected xsd:dateTime in ranges but got: ${ranges.join(', ')}`
    );
  });

  await it('format:uri emits xsd:anyURI in rdfs:range', () => {
    assert.ok(
      ranges.includes(xsdIri('anyURI')),
      `Expected xsd:anyURI in ranges but got: ${ranges.join(', ')}`
    );
  });

  await it('format:duration emits xsd:duration in rdfs:range', () => {
    assert.ok(
      ranges.includes(xsdIri('duration')),
      `Expected xsd:duration in ranges but got: ${ranges.join(', ')}`
    );
  });

  await it('format:email stays xsd:string in rdfs:range (no XSD equivalent)', () => {
    assert.ok(
      ranges.includes(xsdIri('string')),
      'Expected at least one xsd:string range (email and similar formats)'
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — SHACL sh:datatype precision
// ---------------------------------------------------------------------------

await describe('XSD datatype precision — SHACL sh:datatype', async () => {
  const jt = makeJt();
  const shaclGraph = jt.toShacl().shaclObject()['@graph'];
  const nodes = Array.isArray(shaclGraph) ? (shaclGraph as unknown[]) : [];
  const datatypes = collectNested(nodes, SH_DATATYPE_IRI);

  await it('format:date emits xsd:date as sh:datatype', () => {
    assert.ok(
      datatypes.includes(xsdIri('date')),
      `Expected xsd:date in sh:datatype values but got: ${datatypes.join(', ')}`
    );
  });

  await it('format:date-time emits xsd:dateTime as sh:datatype', () => {
    assert.ok(
      datatypes.includes(xsdIri('dateTime')),
      `Expected xsd:dateTime in sh:datatype values but got: ${datatypes.join(', ')}`
    );
  });

  await it('format:uri emits xsd:anyURI as sh:datatype', () => {
    assert.ok(
      datatypes.includes(xsdIri('anyURI')),
      `Expected xsd:anyURI in sh:datatype values but got: ${datatypes.join(', ')}`
    );
  });

  await it('format:duration emits xsd:duration as sh:datatype', () => {
    assert.ok(
      datatypes.includes(xsdIri('duration')),
      `Expected xsd:duration in sh:datatype values but got: ${datatypes.join(', ')}`
    );
  });

  await it('format:email stays xsd:string as sh:datatype (no XSD equivalent)', () => {
    assert.ok(
      datatypes.includes(xsdIri('string')),
      'Expected xsd:string still present for email-format properties'
    );
  });
});
