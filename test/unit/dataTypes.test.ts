// Merged from: curie.test.ts, dataTypes.test.ts, xsdDatatypePrecision.test.ts, xsdMaps.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// SchemaGraphSemanticsType is graph-internal type structure not surfaced by the public API.
import type { SchemaGraphSemanticsType } from '../../src/types/SchemaGraph.js';
// DataType guards/equality helpers are pure utilities used internally; no public surface.
import { DataType } from '../../src/modules/data/DataType.js';
import {
  describe, it
} from 'node:test';
// XsdTypes resolvers power schema-to-XSD mapping; no public surface.
import { XsdTypes } from '../../src/modules/quads/XsdTypes.js';
import {
  OWL, XSD
} from '../../src/constants/IRI.js';
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

  void describe('Curie', { 'concurrency': true }, () => {
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
          'expected': 'urn:uuid:abc-123',
          'input': 'urn:uuid:abc-123',
          'name': 'multiple colons splits on first only (urn prefix): full reference preserved',
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
  void describe('isRecord / isPlainObject — Good/Bad/Ugly', { 'concurrency': true }, () => {
    interface GuardCase { 'expected': boolean;
      'input': unknown;
      'label': string }
    void it('isRecord table-driven', () => {
      const cases: GuardCase[] = [
        {
          'expected': true,
          'input': { 'a': 1 },
          'label': 'plain object'
        },
        {
          'expected': true,
          'input': {},
          'label': 'empty object'
        },
        {
          'expected': false,
          'input': null,
          'label': 'null'
        },
        {
          'expected': false,
          'input': [
            1,
            2
          ],
          'label': 'array'
        },
        {
          'expected': false,
          'input': 'hello',
          'label': 'string'
        },
        {
          'expected': false,
          'input': undefined,
          'label': 'undefined'
        }
      ];

      for (const {
        expected, input, label
      } of cases) {
        assert.equal(DataType.isRecord(input), expected, `DataType.isRecord(${label})`);
      }
    });

    void it('isPlainObject table-driven', () => {
      class Foo {}
      const cases: GuardCase[] = [
        {
          'expected': true,
          'input': {},
          'label': 'empty object literal'
        },
        {
          'expected': true,
          'input': { 'x': 1 },
          'label': 'object with props'
        },
        {
          'expected': true,
          'input': Object.create(null) as Record<string, unknown>,
          'label': 'Object.create(null)'
        },
        {
          'expected': false,
          'input': [
            1,
            2
          ],
          'label': 'array'
        },
        {
          'expected': false,
          'input': new Date(),
          'label': 'Date instance'
        },
        {
          'expected': false,
          'input': null,
          'label': 'null'
        },
        {
          'expected': false,
          'input': new Foo(),
          'label': 'class instance'
        }
      ];

      for (const {
        expected, input, label
      } of cases) {
        assert.equal(DataType.isPlainObject(input), expected, `DataType.isPlainObject(${label})`);
      }
    });
  });

  void describe('deepEqual — Good/Bad/Ugly', { 'concurrency': true }, () => {
    void it('table-driven equality scenarios', () => {
      const obj = { 'a': 1 };
      const nested = {
        'a': {
          'b': [
            1,
            { 'c': 2 }
          ]
        }
      };
      const scenarios: Array<{ 'expected': boolean;
        'label': string;
        'left': unknown;
        'right': unknown }> = [
        // Good
        {
          'expected': true,
          'label': 'equal number primitives',
          'left': 42,
          'right': 42
        },
        {
          'expected': true,
          'label': 'equal string primitives',
          'left': 'abc',
          'right': 'abc'
        },
        {
          'expected': true,
          'label': 'equal boolean primitives',
          'left': true,
          'right': true
        },
        {
          'expected': true,
          'label': 'identical references',
          'left': obj,
          'right': obj
        },
        {
          'expected': true,
          'label': 'structurally equal objects',
          'left': {
            'a': 1,
            'b': 'x'
          },
          'right': {
            'a': 1,
            'b': 'x'
          }
        },
        {
          'expected': true,
          'label': 'equal arrays',
          'left': [
            1,
            2,
            3
          ],
          'right': [
            1,
            2,
            3
          ]
        },
        {
          'expected': true,
          'label': 'nested equality',
          'left': nested,
          'right': {
            'a': {
              'b': [
                1,
                { 'c': 2 }
              ]
            }
          }
        },
        {
          'expected': true,
          'label': 'both null',
          'left': null,
          'right': null
        },
        // Bad
        {
          'expected': false,
          'label': 'unequal object values',
          'left': { 'a': 1 },
          'right': { 'a': 2 }
        },
        {
          'expected': false,
          'label': 'objects with different keys',
          'left': { 'a': 1 },
          'right': { 'b': 1 }
        },
        {
          'expected': false,
          'label': 'arrays of different length',
          'left': [
            1,
            2
          ],
          'right': [
            1,
            2,
            3
          ]
        },
        // Ugly
        {
          'expected': false,
          'label': 'null vs object',
          'left': null,
          'right': { 'a': 1 }
        },
        {
          'expected': false,
          'label': 'object vs null',
          'left': { 'a': 1 },
          'right': null
        },
        {
          'expected': false,
          'label': 'different types (number vs string)',
          'left': 1,
          'right': '1'
        }
      ];

      for (const {
        expected, label, left, right
      } of scenarios) {
        assert.equal(DataType.deepEqual(left, right), expected, `deepEqual: ${label}`);
      }
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
    // enableStrictGraph: false — ArticleSchema uses inline format-constrained
    // properties intentionally: inline shapes (not $ref) ensure the projection
    // emits XSD IRIs as rdfs:range / sh:datatype rather than referenced schema IRIs.
    return JsonTology.create({
      'baseIri': 'https://xsd-test.example',
      'enableStrictGraph': false,
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
    const raw = jt.toTbox().jsonLdObject()['@graph'] as unknown[];
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
  function semantics(schemaTypes: string[], format?: string): SchemaGraphSemanticsType {
    return {
      format,
      schemaTypes
    } as unknown as SchemaGraphSemanticsType;
  }

  void describe('XsdTypes.resolveSingle / XsdTypes.resolve — Good/Bad/Ugly', { 'concurrency': true }, () => {
    void it('resolveSingle table-driven', () => {
      const cases: Array<{ 'expected': null | string;
        'format'?: string;
        'label': string;
        'type': string }> = [
        // Good: scalar type mappings
        {
          'expected': XSD.string,
          'label': 'string',
          'type': 'string'
        },
        {
          'expected': XSD.dateTime,
          'format': 'date-time',
          'label': 'string+date-time',
          'type': 'string'
        },
        {
          'expected': XSD.anyURI,
          'format': 'uri',
          'label': 'string+uri',
          'type': 'string'
        },
        {
          'expected': XSD.string,
          'format': 'unknown-format',
          'label': 'string+unknown format',
          'type': 'string'
        },
        {
          'expected': XSD.decimal,
          'label': 'number',
          'type': 'number'
        },
        {
          'expected': XSD.float,
          'format': 'float',
          'label': 'number+float',
          'type': 'number'
        },
        {
          'expected': XSD.integer,
          'label': 'integer',
          'type': 'integer'
        },
        {
          'expected': XSD.int,
          'format': 'int32',
          'label': 'integer+int32',
          'type': 'integer'
        },
        {
          'expected': XSD.boolean,
          'label': 'boolean',
          'type': 'boolean'
        },
        // Bad / Ugly: non-scalar returns null
        {
          'expected': null,
          'label': 'object',
          'type': 'object'
        },
        {
          'expected': null,
          'label': 'array',
          'type': 'array'
        },
        {
          'expected': null,
          'label': 'unknown type',
          'type': 'foobar'
        }
      ];

      for (const {
        expected, format, label, type
      } of cases) {
        const opts = format === undefined ? undefined : { format };

        assert.equal(XsdTypes.resolveSingle(type, opts), expected, `resolveSingle(${label})`);
      }
    });

    void it('resolve table-driven', () => {
      const cases: Array<{ 'expected': null | string;
        'format'?: string;
        'label': string;
        'types': string[] }> = [
        // Good
        {
          'expected': XSD.string,
          'label': 'single string',
          'types': ['string']
        },
        {
          'expected': XSD.decimal,
          'label': 'single number',
          'types': ['number']
        },
        {
          'expected': XSD.date,
          'format': 'date',
          'label': 'string with format',
          'types': ['string']
        },
        {
          'expected': XSD.string,
          'label': 'string+null (nullable)',
          'types': [
            'string',
            'null'
          ]
        },
        // Bad
        {
          'expected': OWL.Nothing,
          'label': 'null-only',
          'types': ['null']
        },
        {
          'expected': null,
          'label': 'multiple non-null types',
          'types': [
            'string',
            'number'
          ]
        },
        // Ugly
        {
          'expected': null,
          'label': 'empty types array',
          'types': []
        }
      ];

      for (const {
        expected, format, label, types
      } of cases) {
        assert.equal(XsdTypes.resolve(semantics(types, format)), expected, `resolve(${label})`);
      }
    });
  });
}

