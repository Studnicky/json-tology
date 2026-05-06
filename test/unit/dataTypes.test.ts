// Merged from: curie.test.ts, dataTypes.test.ts, xsdDatatypePrecision.test.ts, xsdMaps.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
import type { SchemaGraphSemanticsInterface } from '../../src/interfaces/SchemaGraph.js';
import {
  deepEqual,
  deepFreeze,
  isPlainObject,
  isRecord
} from '../../src/modules/data/DataTypes.js';
import {
  describe, it
} from 'node:test';
import {
  resolveSingleXsdType,
  resolveXsdType
} from '../../src/constants/XSD_MAPS.js';
import {
  Curie, JsonTology
} from '../../src/index.js';

// ===========================================================================
// Source: curie.test.ts
// ===========================================================================
{
  const standardPrefixes: Record<string, string> = {
    'dc': 'http://purl.org/dc/elements/1.1/',
    'dct': 'http://purl.org/dc/terms/',
    'ex': 'https://example.com/',
    'owl': 'http://www.w3.org/2002/07/owl#',
    'rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
    'sh': 'http://www.w3.org/ns/shacl#',
    'xsd': 'http://www.w3.org/2001/XMLSchema#'
  };

  void describe('Curie', () => {
    void it('expands CURIEs to full IRIs', () => {
      const curie = new Curie(standardPrefixes);
      const scenarios: Array<{ 'expected': string;
        'input': string;
        'name': string }> = [
        {
          'expected': 'http://www.w3.org/ns/shacl#property',
          'input': 'sh:property',
          'name': 'expands sh: prefix'
        },
        {
          'expected': 'http://www.w3.org/2002/07/owl#Class',
          'input': 'owl:Class',
          'name': 'expands owl: prefix'
        },
        {
          'expected': 'http://www.w3.org/2000/01/rdf-schema#label',
          'input': 'rdfs:label',
          'name': 'expands rdfs: prefix'
        },
        {
          'expected': 'http://www.w3.org/2001/XMLSchema#string',
          'input': 'xsd:string',
          'name': 'expands xsd: prefix'
        },
        {
          'expected': 'http://purl.org/dc/elements/1.1/title',
          'input': 'dc:title',
          'name': 'expands dc: prefix'
        },
        {
          'expected': 'http://purl.org/dc/terms/title',
          'input': 'dct:title',
          'name': 'expands dct: prefix (distinguishes substring prefixes)'
        },
        {
          'expected': 'https://example.com/path/to/resource',
          'input': 'ex:path/to/resource',
          'name': 'expands local part with slashes'
        },
        {
          'expected': 'https://example.com/name.first',
          'input': 'ex:name.first',
          'name': 'expands local part with dot'
        },
        {
          'expected': 'https://example.com/fragment#sub',
          'input': 'ex:fragment#sub',
          'name': 'expands local part with hash'
        },
        {
          'expected': 'https://example.com/',
          'input': 'ex:',
          'name': 'expands prefix with empty local part'
        },
        {
          'expected': `https://example.com/${'a'.repeat(500)}`,
          'input': `ex:${'a'.repeat(500)}`,
          'name': 'edge: very long local part expands correctly'
        },
        {
          'expected': 'https://example.com/with spaces',
          'input': 'ex:with spaces',
          'name': 'edge: local part with spaces'
        },
        {
          'expected': 'https://example.com/$special!chars',
          'input': 'ex:$special!chars',
          'name': 'edge: local part with special characters'
        }
      ];

      for (const {
        expected, input, name
      } of scenarios) {
        assert.equal(curie.expand(input), expected, name);
      }
    });

    void it('returns input unchanged when no expansion applies', () => {
      const curie = new Curie(standardPrefixes);
      const scenarios: Array<{ 'expected': string;
        'input': string;
        'name': string }> = [
        {
          'expected': 'foo:bar',
          'input': 'foo:bar',
          'name': 'unknown prefix foo:'
        },
        {
          'expected': 'unknown:value',
          'input': 'unknown:value',
          'name': 'unknown prefix unknown:'
        },
        {
          'expected': 'noColon',
          'input': 'noColon',
          'name': 'no colon in value'
        },
        {
          'expected': 'justAWord',
          'input': 'justAWord',
          'name': 'plain word without colon'
        },
        {
          'expected': 'http://www.w3.org/ns/shacl#property',
          'input': 'http://www.w3.org/ns/shacl#property',
          'name': 'full IRI with http:// not treated as prefix'
        },
        {
          'expected': '',
          'input': '',
          'name': 'empty string unchanged'
        },
        {
          'expected': ':',
          'input': ':',
          'name': 'edge: string with only colon — empty prefix not registered'
        },
        {
          'expected': ':value',
          'input': ':value',
          'name': 'edge: colon at start — empty prefix not registered'
        },
        {
          'expected': 'a:b:c:d',
          'input': 'a:b:c:d',
          'name': 'edge: multiple colons with unknown prefix a'
        }
      ];

      for (const {
        expected, input, name
      } of scenarios) {
        assert.equal(curie.expand(input), expected, name);
      }
    });

    void it('handles edge cases for expand (blank nodes, URNs, multiple colons)', () => {
      const scenarios: Array<{ 'expected': string;
        'input': string;
        'name': string;
        'prefixes': Record<string, string> }> = [
        {
          'expected': '_:b0',
          'input': '_:b0',
          'name': 'blank node _:b0 passes through',
          'prefixes': standardPrefixes
        },
        {
          'expected': '_:genid42',
          'input': '_:genid42',
          'name': 'blank node _:genid42 passes through',
          'prefixes': standardPrefixes
        },
        {
          'expected': 'urn:uuid',
          'input': 'urn:uuid:abc-123',
          'name': 'multiple colons splits on first only (urn prefix)',
          'prefixes': { 'urn': 'urn:' }
        },
        {
          'expected': 'urn:uuid:abc-123',
          'input': 'urn:uuid:abc-123',
          'name': 'multiple colons passes through with no matching prefix',
          'prefixes': {}
        }
      ];

      for (const {
        expected, input, name, prefixes
      } of scenarios) {
        const curie = new Curie(prefixes);

        assert.equal(curie.expand(input), expected, name);
      }
    });

    void it('compacts full IRIs to CURIEs', () => {
      const curie = new Curie(standardPrefixes);
      const scenarios: Array<{ 'expected': string;
        'input': string;
        'name': string }> = [
        {
          'expected': 'sh:property',
          'input': 'http://www.w3.org/ns/shacl#property',
          'name': 'compacts sh: namespace'
        },
        {
          'expected': 'owl:Class',
          'input': 'http://www.w3.org/2002/07/owl#Class',
          'name': 'compacts owl: namespace'
        },
        {
          'expected': 'rdfs:label',
          'input': 'http://www.w3.org/2000/01/rdf-schema#label',
          'name': 'compacts rdfs: namespace'
        },
        {
          'expected': 'ex:path/to/resource',
          'input': 'https://example.com/path/to/resource',
          'name': 'compacts IRI with slashes in local part'
        },
        {
          'expected': 'ex:name.first',
          'input': 'https://example.com/name.first',
          'name': 'compacts IRI with dot in local part'
        },
        {
          'expected': 'ex:',
          'input': 'https://example.com/',
          'name': 'compacts IRI equal to namespace (empty local part)'
        }
      ];

      for (const {
        expected, input, name
      } of scenarios) {
        assert.equal(curie.compact(input), expected, name);
      }
    });

    void it('returns input unchanged when no compact applies', () => {
      const curie = new Curie(standardPrefixes);
      const scenarios: Array<{ 'expected': string;
        'input': string;
        'name': string }> = [
        {
          'expected': 'https://unknown.org/thing',
          'input': 'https://unknown.org/thing',
          'name': 'unknown namespace'
        },
        {
          'expected': 'urn:isbn:12345',
          'input': 'urn:isbn:12345',
          'name': 'URN not matching any prefix'
        },
        {
          'expected': '',
          'input': '',
          'name': 'empty string unchanged'
        },
        {
          'expected': `ex:${'a'.repeat(500)}`,
          'input': `https://example.com/${'a'.repeat(500)}`,
          'name': 'edge: very long IRI compacts correctly'
        },
        {
          'expected': ':',
          'input': ':',
          'name': 'edge: string with only colon — not a valid IRI'
        }
      ];

      for (const {
        expected, input, name
      } of scenarios) {
        assert.equal(curie.compact(input), expected, name);
      }
    });

    void it('prefers the longer namespace when namespaces overlap', () => {
      const curie = new Curie({
        'base': 'https://example.com/',
        'specific': 'https://example.com/vocab/'
      });

      assert.equal(curie.compact('https://example.com/vocab/Term'), 'specific:Term', 'longer namespace wins');
    });

    void it('roundtrips compact(expand(curie)) for known prefixes', () => {
      const curie = new Curie(standardPrefixes);
      const scenarios: Array<{ 'name': string;
        'value': string }> = [
        {
          'name': 'sh:property roundtrip',
          'value': 'sh:property'
        },
        {
          'name': 'owl:Class roundtrip',
          'value': 'owl:Class'
        },
        {
          'name': 'rdfs:label roundtrip',
          'value': 'rdfs:label'
        },
        {
          'name': 'xsd:integer roundtrip',
          'value': 'xsd:integer'
        },
        {
          'name': 'ex:Thing roundtrip',
          'value': 'ex:Thing'
        }
      ];

      for (const {
        name, value
      } of scenarios) {
        assert.equal(curie.compact(curie.expand(value)), value, name);
      }
    });

    void it('roundtrips expand(compact(iri)) for known namespaces', () => {
      const curie = new Curie(standardPrefixes);
      const scenarios: Array<{ 'name': string;
        'value': string }> = [
        {
          'name': 'shacl IRI roundtrip',
          'value': 'http://www.w3.org/ns/shacl#property'
        },
        {
          'name': 'owl IRI roundtrip',
          'value': 'http://www.w3.org/2002/07/owl#Class'
        },
        {
          'name': 'rdfs IRI roundtrip',
          'value': 'http://www.w3.org/2000/01/rdf-schema#label'
        },
        {
          'name': 'example IRI roundtrip',
          'value': 'https://example.com/Thing'
        }
      ];

      for (const {
        name, value
      } of scenarios) {
        assert.equal(curie.expand(curie.compact(value)), value, name);
      }
    });
  });
}

// ===========================================================================
// Source: dataTypes.test.ts
// ===========================================================================
{
  void describe('isRecord', () => {
    void it('returns true for a plain object', () => {
      assert.equal(isRecord({ 'a': 1 }), true);
    });

    void it('returns true for an empty object', () => {
      assert.equal(isRecord({}), true);
    });

    void it('returns false for null', () => {
      assert.equal(isRecord(null), false);
    });

    void it('returns false for an array', () => {
      assert.equal(isRecord([
        1,
        2
      ]), false);
    });

    void it('returns false for a string', () => {
      assert.equal(isRecord('hello'), false);
    });

    void it('returns false for undefined', () => {
      assert.equal(isRecord(), false);
    });
  });

  void describe('isPlainObject', () => {
    void it('returns true for an empty object literal', () => {
      assert.equal(isPlainObject({}), true);
    });

    void it('returns true for an object with properties', () => {
      assert.equal(isPlainObject({ 'x': 1 }), true);
    });

    void it('returns true for Object.create(null)', () => {
      assert.equal(isPlainObject(Object.create(null)), true);
    });

    void it('returns false for an array', () => {
      assert.equal(isPlainObject([
        1,
        2
      ]), false);
    });

    void it('returns false for a Date instance', () => {
      assert.equal(isPlainObject(new Date()), false);
    });

    void it('returns false for null', () => {
      assert.equal(isPlainObject(null), false);
    });

    void it('returns false for a class instance', () => {
      class Foo {}
      assert.equal(isPlainObject(new Foo()), false);
    });
  });

  void describe('deepEqual', () => {
    void it('returns true for equal primitives', () => {
      assert.equal(deepEqual(42, 42), true);
      assert.equal(deepEqual('abc', 'abc'), true);
      assert.equal(deepEqual(true, true), true);
    });

    void it('returns true for identical references', () => {
      const obj = { 'a': 1 };

      assert.equal(deepEqual(obj, obj), true);
    });

    void it('returns true for structurally equal objects', () => {
      assert.equal(deepEqual({
        'a': 1,
        'b': 'x'
      }, {
        'a': 1,
        'b': 'x'
      }), true);
    });

    void it('returns false for unequal objects', () => {
      assert.equal(deepEqual({ 'a': 1 }, { 'a': 2 }), false);
    });

    void it('returns false for objects with different keys', () => {
      assert.equal(deepEqual({ 'a': 1 }, { 'b': 1 }), false);
    });

    void it('returns true for equal arrays', () => {
      assert.equal(deepEqual([
        1,
        2,
        3
      ], [
        1,
        2,
        3
      ]), true);
    });

    void it('returns false for arrays of different length', () => {
      assert.equal(deepEqual([
        1,
        2
      ], [
        1,
        2,
        3
      ]), false);
    });

    void it('handles nested equality', () => {
      const left = {
        'a': {
          'b': [
            1,
            { 'c': 2 }
          ]
        }
      };
      const right = {
        'a': {
          'b': [
            1,
            { 'c': 2 }
          ]
        }
      };

      assert.equal(deepEqual(left, right), true);
    });

    void it('returns false when one side is null', () => {
      assert.equal(deepEqual(null, { 'a': 1 }), false);
      assert.equal(deepEqual({ 'a': 1 }, null), false);
    });

    void it('returns true when both sides are null', () => {
      assert.equal(deepEqual(null, null), true);
    });

    void it('returns false for different types', () => {
      assert.equal(deepEqual(1, '1'), false);
    });
  });

  void describe('deepFreeze', () => {
    void it('freezes the top-level object', () => {
      const obj = { 'a': 1 };

      deepFreeze(obj);
      assert.equal(Object.isFrozen(obj), true);
    });

    void it('freezes nested objects', () => {
      const obj = { 'nested': { 'value': 42 } };

      deepFreeze(obj);
      assert.equal(Object.isFrozen(obj.nested), true);
    });

    void it('freezes deeply nested structures', () => {
      const obj = { 'a': { 'b': { 'c': 3 } } };

      deepFreeze(obj);
      assert.equal(Object.isFrozen(obj.a.b), true);
    });

    void it('returns the same reference', () => {
      const obj = { 'x': 1 };
      const result = deepFreeze(obj);

      assert.equal(result, obj);
    });
  });
}

// ===========================================================================
// Source: xsdDatatypePrecision.test.ts
// ===========================================================================
{
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
}

// ===========================================================================
// Source: xsdMaps.test.ts
// ===========================================================================
{
  function semantics(schemaTypes: string[], format?: string): SchemaGraphSemanticsInterface {
    return {
      format,
      schemaTypes
    } as unknown as SchemaGraphSemanticsInterface;
  }

  void describe('resolveSingleXsdType', () => {
    void it('maps string to xsd:string', () => {
      assert.equal(resolveSingleXsdType('string'), 'xsd:string');
    });

    void it('maps string with date-time format to xsd:dateTime', () => {
      assert.equal(resolveSingleXsdType('string', { 'format': 'date-time' }), 'xsd:dateTime');
    });

    void it('maps string with uri format to xsd:anyURI', () => {
      assert.equal(resolveSingleXsdType('string', { 'format': 'uri' }), 'xsd:anyURI');
    });

    void it('maps string with unknown format to xsd:string', () => {
      assert.equal(resolveSingleXsdType('string', { 'format': 'unknown-format' }), 'xsd:string');
    });

    void it('maps number to xsd:decimal', () => {
      assert.equal(resolveSingleXsdType('number'), 'xsd:decimal');
    });

    void it('maps number with float format to xsd:float', () => {
      assert.equal(resolveSingleXsdType('number', { 'format': 'float' }), 'xsd:float');
    });

    void it('maps integer to xsd:integer', () => {
      assert.equal(resolveSingleXsdType('integer'), 'xsd:integer');
    });

    void it('maps integer with int32 format to xsd:int', () => {
      assert.equal(resolveSingleXsdType('integer', { 'format': 'int32' }), 'xsd:int');
    });

    void it('maps boolean to xsd:boolean', () => {
      assert.equal(resolveSingleXsdType('boolean'), 'xsd:boolean');
    });

    void it('returns null for object type', () => {
      assert.equal(resolveSingleXsdType('object'), null);
    });

    void it('returns null for array type', () => {
      assert.equal(resolveSingleXsdType('array'), null);
    });

    void it('returns null for unknown type', () => {
      assert.equal(resolveSingleXsdType('foobar'), null);
    });
  });

  void describe('resolveXsdType', () => {
    void it('resolves a single string type', () => {
      assert.equal(resolveXsdType(semantics(['string'])), 'xsd:string');
    });

    void it('resolves a single number type', () => {
      assert.equal(resolveXsdType(semantics(['number'])), 'xsd:decimal');
    });

    void it('resolves string with format', () => {
      assert.equal(resolveXsdType(semantics(['string'], 'date')), 'xsd:date');
    });

    void it('returns owl:Nothing for null-only type', () => {
      assert.equal(resolveXsdType(semantics(['null'])), 'owl:Nothing');
    });

    void it('filters out null and resolves remaining type', () => {
      assert.equal(resolveXsdType(semantics([
        'string',
        'null'
      ])), 'xsd:string');
    });

    void it('returns null for multiple non-null types', () => {
      assert.equal(resolveXsdType(semantics([
        'string',
        'number'
      ])), null);
    });

    void it('returns null for empty types array', () => {
      assert.equal(resolveXsdType(semantics([])), null);
    });
  });
}

