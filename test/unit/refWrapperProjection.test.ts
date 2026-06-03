/**
 * ABox projection through transparent `$ref` wrappers.
 *
 * Two canonical idioms wrap a real `$ref` in a union or `allOf`, leaving the
 * property node itself ref-less so projection previously lost the referenced
 * schema's semantics:
 *
 *   Gap 1 — an OPTIONAL nested ref `allOf: [{ $ref: Class }]` projected the
 *           nested node as `a <…#/properties/<prop>>` (the property-shape IRI)
 *           instead of `a <Class>`.
 *   Gap 2 — a `$ref` to a `{ type: string, format: date-time }` primitive,
 *           wrapped in `anyOf: [{ $ref: Timestamp }, { type: null }]`, projected
 *           the literal as `xsd:string` instead of `xsd:dateTime`.
 *
 * Projection.projectInstance now follows a transparent wrapper (single non-null
 * `$ref` member of `anyOf`/`oneOf`, or a sole `$ref` member of `allOf`) to the
 * referenced target, so both the leaf datatype and the nested node's `rdf:type`
 * come from the referenced schema. A direct `$ref` (already resolved by
 * resolveNode) is unaffected.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';
import { XSD } from '../../src/constants/IRI.js';
import type { QuadInterface } from '../../src/interfaces/Quad.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

const TimestampSchema = {
  '$id': 'https://example.com/Timestamp',
  'format': 'date-time',
  'type': 'string'
} as const;

const LatSchema = {
  '$id': 'https://example.com/Lat',
  'type': 'number'
} as const;

const LonSchema = {
  '$id': 'https://example.com/Lon',
  'type': 'number'
} as const;

const GeoPointSchema = {
  '$id': 'https://example.com/GeoPoint',
  'properties': {
    'latitude': { '$ref': 'https://example.com/Lat' },
    'longitude': { '$ref': 'https://example.com/Lon' }
  },
  'required': [
    'latitude',
    'longitude'
  ],
  'type': 'object'
} as const;

function literalDatatypeForPredicate(quads: QuadInterface[], predicate: string): string | undefined {
  for (const quad of quads) {
    if (quad.predicate.value === predicate && quad.object.termType === 'Literal') {
      return quad.object.datatype.value;
    }
  }

  return undefined;
}

function rdfTypeOf(quads: QuadInterface[], subjectPredicate: (value: string) => boolean): string | undefined {
  for (const quad of quads) {
    if (
      quad.predicate.value === RDF_TYPE
      && subjectPredicate(quad.subject.value)
      && quad.object.termType === 'NamedNode'
    ) {
      return quad.object.value;
    }
  }

  return undefined;
}

void describe('ABox projection through transparent $ref wrappers', { 'concurrency': true }, () => {
  void it('Gap 2: anyOf[{ $ref date-time }, null] leaf projects an xsd:dateTime literal', () => {
    const EventSchema = {
      '$id': 'https://example.com/EventAnyOfTime',
      'properties': {
        'publishedAt': {
          'anyOf': [
            { '$ref': 'https://example.com/Timestamp' },
            { 'type': 'null' }
          ]
        }
      },
      'required': ['publishedAt'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [
        TimestampSchema,
        EventSchema
      ]
    });

    const instance = jt.instantiate(EventSchema.$id, { 'publishedAt': '2026-05-31T00:00:00.000Z' });
    const quads = jt.toQuads(EventSchema, instance, {});
    const datatype = literalDatatypeForPredicate(quads, 'https://example.com/publishedAt');

    assert.equal(
      datatype,
      XSD.dateTime,
      'anyOf-wrapped $ref to a date-time primitive must project xsd:dateTime, not xsd:string'
    );
  });

  void it('Gap 2: a DIRECT $ref to a date-time primitive still projects xsd:dateTime', () => {
    const EventSchema = {
      '$id': 'https://example.com/EventDirectTime',
      'properties': { 'publishedAt': { '$ref': 'https://example.com/Timestamp' } },
      'required': ['publishedAt'],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [
        TimestampSchema,
        EventSchema
      ]
    });

    const instance = jt.instantiate(EventSchema.$id, { 'publishedAt': '2026-05-31T00:00:00.000Z' });
    const quads = jt.toQuads(EventSchema, instance, {});
    const datatype = literalDatatypeForPredicate(quads, 'https://example.com/publishedAt');

    assert.equal(datatype, XSD.dateTime, 'a direct $ref to a date-time primitive must project xsd:dateTime');
  });

  void it('Gap 1: allOf[{ $ref: Class }] optional nested node is typed a <Class>', () => {
    const EventSchema = {
      '$id': 'https://example.com/EventGeo',
      'properties': { 'geo': { 'allOf': [{ '$ref': 'https://example.com/GeoPoint' }] } },
      'required': [],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [
        LatSchema,
        LonSchema,
        GeoPointSchema,
        EventSchema
      ]
    });

    const instance = jt.instantiate(EventSchema.$id, {
      'geo': {
        'latitude': 1,
        'longitude': 2
      }
    });
    const quads = jt.toQuads(EventSchema, instance, {});

    // The nested geo node (its subject is NOT the root Event instance) must be
    // typed as the referenced GeoPoint class, not the property-shape IRI.
    const rootIri = rdfTypeOf(quads, (subject) => {
      return subject.includes('EventGeo') && !subject.includes('GeoPoint');
    });

    assert.equal(rootIri, EventSchema.$id, 'sanity: root instance is typed a Event');

    const nestedType = rdfTypeOf(quads, (subject) => {
      return subject.includes('GeoPoint');
    });

    assert.equal(
      nestedType,
      GeoPointSchema.$id,
      'allOf-wrapped $ref nested node must be typed a <GeoPoint>, not a #/properties/geo shape IRI'
    );

    // And no quad may carry the property-shape IRI as an rdf:type object.
    const shapeTyped = quads.some((quad) => {
      return quad.predicate.value === RDF_TYPE
        && quad.object.termType === 'NamedNode'
        && quad.object.value.includes('#/properties/');
    });

    assert.equal(shapeTyped, false, 'no nested node should be typed by a #/properties/<prop> shape IRI');
  });

  void it('Gap 1: anyOf[{ $ref: Class }, null] nullable nested node is also typed a <Class>', () => {
    const EventSchema = {
      '$id': 'https://example.com/EventGeoNullable',
      'properties': {
        'geo': {
          'anyOf': [
            { '$ref': 'https://example.com/GeoPoint' },
            { 'type': 'null' }
          ]
        }
      },
      'required': [],
      'type': 'object'
    } as const;

    const jt = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [
        LatSchema,
        LonSchema,
        GeoPointSchema,
        EventSchema
      ]
    });

    const instance = jt.instantiate(EventSchema.$id, {
      'geo': {
        'latitude': 1,
        'longitude': 2
      }
    });
    const quads = jt.toQuads(EventSchema, instance, {});

    const nestedType = rdfTypeOf(quads, (subject) => {
      return subject.includes('GeoPoint');
    });

    assert.equal(
      nestedType,
      GeoPointSchema.$id,
      'anyOf-wrapped nullable $ref nested node must be typed a <GeoPoint>'
    );
  });
});
