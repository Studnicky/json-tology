// Merged from: graphSchemaSerializer.test.ts, quadProjection.test.ts, quadRoundTrip.test.ts, roundTrip.test.ts, serializationEdgeCases.test.ts, shaclSerializer.test.ts, ontologyBuilder.test.ts
// Phase-1 mechanical consolidation per .audits/test-consolidation-2026-05.md

import assert from 'node:assert/strict';
// QuadInterface and SchemaRegistryInterface are graph-level type-only contracts not surfaced by the public API.
import type { QuadInterface } from '../../src/interfaces/Quad.js';
import type { SchemaRegistryInterface } from '../../src/interfaces/SchemaRegistry.js';
import {
  describe, it
} from 'node:test';
import {
  GraphOntologySerializer, JsonTology, OntologyBuilder
} from '../../src/index.js';
// Internal access: ontology serialization unit tests directly probe the graph
// serializer pipeline (SchemaGraph construction, projection helpers, the SHACL
// serializer, GraphSchemaSerializer round-trip). These graph-level surfaces are
// the contract being asserted; the public ontology() / toQuads() methods only
// expose composed output, not the per-quad projection shape.
import { Projection } from '../../src/modules/rdf/Projection.js';
import { GraphSchemaSerializer } from '../../src/modules/ontology/GraphSchemaSerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

// ===========================================================================
// Source: graphSchemaSerializer.test.ts
// ===========================================================================
{
  function roundtrip(input: Record<string, unknown>): Record<string, unknown> {
    const serializer = new GraphSchemaSerializer();
    const graph = new SchemaGraph(input);

    return serializer.serialize(graph);
  }

  // ---------------------------------------------------------------------------
  // Basic roundtrip scenarios
  // ---------------------------------------------------------------------------

  void describe('GraphSchemaSerializer basic roundtrip', () => {
    const serializer = new GraphSchemaSerializer();

    const basicScenarios: Array<{
      'check': (result: Record<string, unknown>) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (result) => {
          assert.equal(result.$id, 'https://example.com/Basic');
          assert.equal(result.type, 'object');
          const props = result.properties as Record<string, Record<string, unknown>>;

          assert.deepEqual(props.name, { 'type': 'string' });
          assert.deepEqual(props.count, { 'type': 'number' });
        },
        'name': 'roundtrips basic object schema with properties',
        'schema': {
          '$id': 'https://example.com/Basic',
          'properties': {
            'count': { 'type': 'number' },
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (result) => {
          assert.ok(result.$defs !== undefined);
          const defs = result.$defs as Record<string, Record<string, unknown>>;

          assert.equal(defs.Address.type, 'object');
          const addrProps = defs.Address.properties as Record<string, Record<string, unknown>>;

          assert.deepEqual(addrProps.street, { 'type': 'string' });
        },
        'name': 'roundtrips $defs with internal $ref',
        'schema': {
          '$defs': {
            'Address': {
              'properties': { 'street': { 'type': 'string' } },
              'type': 'object'
            }
          },
          '$id': 'https://example.com/WithDefs',
          'properties': { 'home': { '$ref': '#/$defs/Address' } },
          'type': 'object'
        }
      },
      {
        'check': (result) => {
          const anchorProps = result.properties as Record<string, Record<string, unknown>>;

          assert.equal(anchorProps.tag.$anchor, 'tag-node');
        },
        'name': 'roundtrips $anchor on properties',
        'schema': {
          '$id': 'https://example.com/Anchored',
          'properties': {
            'tag': {
              '$anchor': 'tag-node',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (result) => {
          assert.deepEqual(result.required, [
            'id',
            'name'
          ]);
        },
        'name': 'roundtrips required array',
        'schema': {
          '$id': 'https://example.com/Required',
          'properties': {
            'id': { 'type': 'string' },
            'name': { 'type': 'string' }
          },
          'required': [
            'id',
            'name'
          ],
          'type': 'object'
        }
      },
      {
        'check': (result) => {
          assert.equal(result.type, 'array');
          assert.deepEqual(result.items, { 'type': 'string' });
        },
        'name': 'roundtrips array items',
        'schema': {
          '$id': 'https://example.com/Arr',
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      {
        'check': (result) => {
          const props = result.properties as Record<string, unknown> | undefined;

          assert.ok(props !== undefined, 'properties must exist');
        },
        'name': 'roundtrips boolean true schema (permissive)',
        'schema': {
          '$id': 'https://example.com/BoolTrue',
          'properties': { 'anything': true as unknown as Record<string, unknown> },
          'type': 'object'
        }
      },
      {
        'check': (result) => {
          assert.equal(result.type, 'object');
        },
        'name': 'roundtrips schema with empty properties object',
        'schema': {
          '$id': 'https://example.com/EmptyProps',
          'properties': {},
          'type': 'object'
        }
      }
    ];

    for (const {
      check, 'name': scenarioName, schema
    } of basicScenarios) {
      void it(scenarioName, () => {
        const result = serializer.serialize(new SchemaGraph(schema));

        check(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Composition and constraints
  // ---------------------------------------------------------------------------

  void describe('GraphSchemaSerializer composition and constraints', () => {
    const serializer = new GraphSchemaSerializer();

    const compositionScenarios: Array<{
      'check': (result: Record<string, unknown>) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [
      {
        'check': (result) => {
          assert.ok(Array.isArray(result.allOf));
          assert.equal((result.allOf as unknown[]).length, 2);
        },
        'name': 'preserves allOf composition',
        'schema': {
          '$id': 'https://example.com/allOf',
          'allOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'check': (result) => {
          assert.ok(Array.isArray(result.anyOf));
          assert.equal((result.anyOf as unknown[]).length, 2);
        },
        'name': 'preserves anyOf composition',
        'schema': {
          '$id': 'https://example.com/anyOf',
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'check': (result) => {
          assert.ok(Array.isArray(result.oneOf));
          assert.equal((result.oneOf as unknown[]).length, 2);
        },
        'name': 'preserves oneOf composition',
        'schema': {
          '$id': 'https://example.com/oneOf',
          'oneOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'check': (result) => {
          assert.equal(result.pattern, '^[a-z]+$');
          assert.equal(result.format, 'email');
        },
        'name': 'preserves pattern and format',
        'schema': {
          '$id': 'https://example.com/Constrained',
          'format': 'email',
          'pattern': '^[a-z]+$',
          'type': 'string'
        }
      },
      {
        'check': (result) => {
          assert.equal(result.minimum, 0);
          assert.equal(result.maximum, 100);
          assert.equal(result.multipleOf, 5);
        },
        'name': 'preserves numeric constraints',
        'schema': {
          '$id': 'https://example.com/Numeric',
          'maximum': 100,
          'minimum': 0,
          'multipleOf': 5,
          'type': 'number'
        }
      },
      {
        'check': (result) => {
          assert.deepEqual(result.enum, [
            'red',
            'green',
            'blue'
          ]);
        },
        'name': 'preserves enum',
        'schema': {
          '$id': 'https://example.com/Enum',
          'enum': [
            'red',
            'green',
            'blue'
          ],
          'type': 'string'
        }
      },
      {
        'check': (result) => {
          assert.equal(result.const, 'fixed');
        },
        'name': 'preserves const',
        'schema': {
          '$id': 'https://example.com/Const',
          'const': 'fixed'
        }
      },
      {
        'check': (result) => {
          assert.equal(result.title, 'A title');
          assert.equal(result.description, 'A description');
        },
        'name': 'preserves title and description',
        'schema': {
          '$id': 'https://example.com/Meta',
          'description': 'A description',
          'title': 'A title',
          'type': 'string'
        }
      }
    ];

    for (const {
      check, 'name': scenarioName, schema
    } of compositionScenarios) {
      void it(scenarioName, () => {
        const result = serializer.serialize(new SchemaGraph(schema));

        check(result);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Graph identity roundtrip
  // ---------------------------------------------------------------------------

  void describe('GraphSchemaSerializer graph identity', () => {
    const identityScenarios: Array<{
      'check': (first: Record<string, unknown>, second: Record<string, unknown>) => void;
      'name': string;
      'schema': Record<string, unknown>;
    }> = [{
      'check': (first, second) => {
        assert.deepEqual(first, second);

        assert.equal(first.$id, 'https://example.com/Roundtrip');

        const defs = first.$defs as Record<string, Record<string, unknown>>;

        assert.ok('Foo' in defs && 'Bar' in defs);
        assert.equal(defs.Foo.$anchor, 'MyAnchor');
        assert.equal(defs.Bar.$dynamicAnchor, 'DynBar');
        const fooProps = defs.Foo.properties as Record<string, Record<string, unknown>>;

        assert.deepEqual(fooProps.label, { 'type': 'string' });
        assert.deepEqual(defs.Foo.required, ['label']);

        const props = first.properties as Record<string, Record<string, unknown>>;

        assert.equal(props.localRef.$ref, '#/$defs/Foo');
        assert.equal(props.anchorRef.$ref, '#MyAnchor');
        assert.equal(props.nested.type, 'object');
        const nestedProps = props.nested.properties as Record<string, Record<string, unknown>>;

        assert.deepEqual(nestedProps.deep, { 'type': 'integer' });
      },
      'name': 'stable output: first pass equals second pass',
      'schema': {
        '$defs': {
          'Bar': {
            '$dynamicAnchor': 'DynBar',
            'properties': { 'score': { 'type': 'number' } },
            'type': 'object'
          },
          'Foo': {
            '$anchor': 'MyAnchor',
            'properties': { 'label': { 'type': 'string' } },
            'required': ['label'],
            'type': 'object'
          }
        },
        '$id': 'https://example.com/Roundtrip',
        'properties': {
          'anchorRef': { '$ref': '#MyAnchor' },
          'localRef': { '$ref': '#/$defs/Foo' },
          'nested': {
            'properties': { 'deep': { 'type': 'integer' } },
            'type': 'object'
          }
        },
        'required': ['localRef'],
        'type': 'object'
      }
    }];

    for (const {
      check, 'name': scenarioName, schema
    } of identityScenarios) {
      void it(scenarioName, () => {
        const first = roundtrip(schema);
        const second = roundtrip(first);

        check(first, second);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Metadata, custom keywords, and extensions
  // ---------------------------------------------------------------------------

  void describe('GraphSchemaSerializer metadata and extensions', () => {
    const serializer = new GraphSchemaSerializer();

    const extensionScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const commented = serializer.serialize(new SchemaGraph({
            '$comment': 'Root comment',
            '$id': 'https://example.com/NestedComment',
            'properties': {
              'name': {
                '$comment': 'Name field comment',
                'type': 'string'
              }
            },
            'type': 'object'
          }));

          assert.equal(commented.$comment, 'Root comment');
          const commentedProps = commented.properties as Record<string, Record<string, unknown>>;

          assert.equal(commentedProps.name.$comment, 'Name field comment');
        },
        'name': 'preserves $comment on root and nested'
      },
      {
        'check': () => {
          const customSchema = {
            '$id': 'https://example.com/Custom',
            'evenNumber': true,
            'type': 'integer',
            'x-ui-widget': 'slider',
            'x-validation-group': 'pricing'
          };
          const customResult = serializer.serialize(new SchemaGraph(customSchema));

          assert.equal(customResult['x-ui-widget'], 'slider');
          assert.equal(customResult['x-validation-group'], 'pricing');
          assert.equal(customResult.evenNumber, true);
        },
        'name': 'preserves custom keywords (x-* and arbitrary)'
      },
      {
        'check': () => {
          const customRt = {
            '$id': 'https://example.com/CustomRoundtrip',
            'properties': {
              'price': {
                'minimum': 0,
                'type': 'number',
                'x-currency': 'USD'
              }
            },
            'type': 'object',
            'x-table': 'products'
          };
          const first = roundtrip(customRt);
          const second = roundtrip(first);

          assert.deepEqual(first, second);
          assert.equal(first['x-table'], 'products');
          const priceProps = first.properties as Record<string, Record<string, unknown>>;

          assert.equal(priceProps.price['x-currency'], 'USD');
        },
        'name': 'custom keywords roundtrip through two passes'
      },
      {
        'check': () => {
          const exSchema = {
            '$id': 'https://example.com/WithExamples',
            'examples': [
              'alpha',
              'beta'
            ],
            'type': 'string'
          };
          const exResult = serializer.serialize(new SchemaGraph(exSchema));

          assert.deepEqual(exResult.examples, [
            'alpha',
            'beta'
          ]);

          const objSchema = {
            '$id': 'https://example.com/ObjExamples',
            'properties': {
              'name': {
                'examples': [
                  'Alice',
                  'Bob'
                ],
                'type': 'string'
              }
            },
            'type': 'object'
          };
          const objResult = serializer.serialize(new SchemaGraph(objSchema));
          const objProps = objResult.properties as Record<string, Record<string, unknown>>;

          assert.deepEqual(objProps.name.examples, [
            'Alice',
            'Bob'
          ]);
        },
        'name': 'preserves examples on root and nested'
      },
      {
        'check': () => {
          const defSchema = {
            '$id': 'https://example.com/WithDefinitions',
            'definitions': {
              'Addr': {
                'properties': { 'street': { 'type': 'string' } },
                'type': 'object'
              }
            },
            'type': 'object'
          };
          const defResult = serializer.serialize(new SchemaGraph(defSchema));
          const defDefs = (defResult.definitions ?? defResult.$defs) as
          Record<string, Record<string, unknown>> | undefined;

          assert.ok(defDefs !== undefined);
          assert.equal(defDefs.Addr.type, 'object');
          const defAddrProps = defDefs.Addr.properties as Record<string, Record<string, unknown>>;

          assert.deepEqual(defAddrProps.street, { 'type': 'string' });
        },
        'name': 'preserves definitions (draft-07 alias)'
      },
      {
        'check': () => {
          const aiSchema = {
            '$id': 'https://example.com/WithAdditionalItems',
            'additionalItems': { 'type': 'boolean' },
            'items': [
              { 'type': 'string' },
              { 'type': 'number' }
            ],
            'type': 'array'
          };
          const aiResult = serializer.serialize(new SchemaGraph(aiSchema));

          assert.deepEqual(aiResult.additionalItems, { 'type': 'boolean' });
        },
        'name': 'preserves additionalItems'
      },
      {
        'check': () => {
          const recSchema = {
            '$id': 'https://example.com/Recursive',
            '$recursiveAnchor': true,
            'properties': {
              'children': {
                'items': { '$recursiveRef': '#' },
                'type': 'array'
              }
            },
            'type': 'object'
          };
          const recResult = serializer.serialize(new SchemaGraph(recSchema));

          assert.equal(recResult.$recursiveAnchor, true);
          const recProps = recResult.properties as Record<string, Record<string, Record<string, unknown>>>;

          assert.equal(recProps.children.items.$recursiveRef, '#');
        },
        'name': 'preserves $recursiveAnchor and $recursiveRef'
      }
    ];

    for (const {
      check, 'name': scenarioName
    } of extensionScenarios) {
      void it(scenarioName, () => {
        check();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Discriminator roundtrip
  // ---------------------------------------------------------------------------

  void describe('GraphSchemaSerializer discriminator roundtrip', () => {
    const discriminatorScenarios: Array<{
      'expectedMapping': Record<string, string> | undefined;
      'expectedPropertyName': string;
      'name': string;
      'schema': Record<string, unknown>;
      'stableAcrossTwoPasses': boolean;
    }> = [
      {
        'expectedMapping': {
          'cat': '#/$defs/Cat',
          'dog': '#/$defs/Dog'
        },
        'expectedPropertyName': 'kind',
        'name': 'with mapping',
        'schema': {
          '$id': 'https://example.com/Disc',
          'discriminator': {
            'mapping': {
              'cat': '#/$defs/Cat',
              'dog': '#/$defs/Dog'
            },
            'propertyName': 'kind'
          },
          'oneOf': [
            {
              'properties': { 'kind': { 'const': 'cat' } },
              'type': 'object'
            },
            {
              'properties': { 'kind': { 'const': 'dog' } },
              'type': 'object'
            }
          ]
        },
        'stableAcrossTwoPasses': true
      },
      {
        'expectedMapping': undefined,
        'expectedPropertyName': 'kind',
        'name': 'without mapping',
        'schema': {
          '$id': 'https://example.com/DiscNoMap',
          'discriminator': { 'propertyName': 'kind' },
          'oneOf': [{
            'properties': { 'kind': { 'const': 'a' } },
            'type': 'object'
          }]
        },
        'stableAcrossTwoPasses': false
      }
    ];

    for (const {
      expectedMapping, expectedPropertyName, 'name': scenarioName, schema, stableAcrossTwoPasses
    } of discriminatorScenarios) {
      void it(scenarioName, () => {
        const result = roundtrip(schema);
        const disc = result.discriminator as Record<string, unknown>;

        assert.ok(typeof disc === 'object', `${scenarioName}: discriminator must be object`);
        assert.equal(disc.propertyName, expectedPropertyName, `${scenarioName}: propertyName`);
        assert.deepEqual(disc.mapping, expectedMapping, `${scenarioName}: mapping`);

        if (stableAcrossTwoPasses) {
          const second = roundtrip(result);

          assert.deepEqual(result, second);
        }
      });
    }
  });

  // ---------------------------------------------------------------------------
  // JsonTology.toSchema() end-to-end
  // ---------------------------------------------------------------------------

  void describe('GraphSchemaSerializer via JsonTology.toSchema()', () => {
    const e2eScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const schema = {
            '$comment': 'End-to-end comment',
            '$id': 'https://example.com/E2E',
            'properties': {
              'score': {
                'type': 'number',
                'x-widget': 'gauge'
              }
            },
            'required': ['score'],
            'type': 'object',
            'x-api-version': 2
          };
          const jt = JsonTology.create({
            'baseIRI': 'https://example.com',
            'schemas': [schema] as const
          });
          const result = jt.toSchema(schema.$id);

          assert.ok(result !== undefined);
          assert.equal(result.$comment, 'End-to-end comment');
          assert.equal(result['x-api-version'], 2);
          const scoreProps = result.properties as Record<string, Record<string, unknown>>;

          assert.equal(scoreProps.score['x-widget'], 'gauge');
          assert.equal(result.type, 'object');
          assert.deepEqual(result.required, ['score']);
        },
        'name': 'roundtrips custom keywords through JsonTology.toSchema()'
      },
      {
        'check': () => {
          const exSchema = {
            '$id': 'https://example.com/E2E-Examples',
            'examples': [
              'hello',
              'world'
            ],
            'type': 'string'
          };
          const jt = JsonTology.create({
            'baseIRI': 'https://example.com',
            'schemas': [exSchema] as const
          });
          const exResult = jt.toSchema(exSchema.$id);

          assert.ok(exResult !== undefined);
          assert.deepEqual(exResult.examples, [
            'hello',
            'world'
          ]);
        },
        'name': 'roundtrips examples through JsonTology.toSchema()'
      },
      {
        'check': () => {
          const jt = JsonTology.create({
            'baseIRI': 'https://example.com',
            'schemas': []
          });
          const result = jt.toSchema('https://example.com/nonexistent');

          assert.equal(result, undefined);
        },
        'name': 'toSchema() returns undefined for unregistered $id'
      }
    ];

    for (const {
      check, 'name': scenarioName
    } of e2eScenarios) {
      void it(scenarioName, () => {
        check();
      });
    }
  });
}

// ===========================================================================
// Source: quadProjection.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

  function findQuads(quads: QuadInterface[], predicate: string): QuadInterface[] {
    return quads.filter((quad) => {
      return quad.predicate === predicate;
    });
  }

  function findQuadsForSubject(quads: QuadInterface[], subject: string, predicate: string): QuadInterface[] {
    return quads.filter((quad) => {
      return quad.subject === subject && quad.predicate === predicate;
    });
  }

  function hasIriQuad(quads: QuadInterface[], subject: string, predicate: string, objectIri: string): boolean {
    return quads.some((quad) => {
      return quad.subject === subject
    && quad.predicate === predicate
    && quad.object.termType === 'NamedNode'
    && quad.object.value === objectIri;
    });
  }

  // eslint-disable-next-line @stylistic/max-len
  function hasLiteralQuad(quads: QuadInterface[], subject: string, predicate: string, value: unknown, datatype?: string): boolean {
    return quads.some((quad) => {
      return quad.subject === subject
    && quad.predicate === predicate
    && quad.object.termType === 'Literal'
    && quad.object.value === value
    && (datatype === undefined || quad.object.datatype.value === datatype);
    });
  }

  function hasBnodeQuad(quads: QuadInterface[], subject: string, predicate: string): QuadInterface | undefined {
    return quads.find((quad) => {
      return quad.subject === subject
    && quad.predicate === predicate
    && quad.object.termType === 'BlankNode';
    });
  }

  function bnodeId(quad: QuadInterface): string {
    if (quad.object.termType === 'BlankNode') {
      return quad.object.value;
    }
    throw new Error('Expected bnode object');
  }

  function tboxQuads(schema: Record<string, unknown>): QuadInterface[] {
    const graph = new SchemaGraph(schema);

    return Projection.graph(graph);
  }

  // ---------------------------------------------------------------------------
  // TBox tests
  // ---------------------------------------------------------------------------

  void describe('projectGraph — TBox projection', () => {
    void describe('class, property, domain, and required-restriction quads', () => {
      const scenarios: Array<{ 'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>; }> = [
        {
          'check': (quads) => {
            assert.ok(hasIriQuad(quads, 'https://example.com/Person', 'rdf:type', 'owl:Class'));
            assert.ok(hasIriQuad(
              quads,
              'https://example.com/Person#/properties/name',
              'rdf:type',
              'owl:DatatypeProperty'
            ));
            assert.ok(hasIriQuad(
              quads,
              'https://example.com/Person#/properties/age',
              'rdf:type',
              'owl:DatatypeProperty'
            ));
            assert.ok(hasIriQuad(
              quads,
              'https://example.com/Person#/properties/name',
              'rdfs:domain',
              'https://example.com/Person'
            ));
          },
          'name': 'emits owl:Class for object schema',
          'schema': {
            '$id': 'https://example.com/Person',
            'properties': {
              'age': { 'type': 'integer' },
              'name': { 'type': 'string' }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const restrictionLink = hasBnodeQuad(quads, 'https://example.com/Person', 'rdfs:subClassOf');

            assert.ok(restrictionLink, 'should have restriction bnode');

            const bId = bnodeId(restrictionLink);

            assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Restriction'));
            assert.ok(hasIriQuad(quads, bId, 'owl:onProperty', 'https://example.com/Person#name'));
            assert.ok(hasLiteralQuad(quads, bId, 'owl:minCardinality', 1, 'xsd:nonNegativeInteger'));
            assert.ok(hasLiteralQuad(
              quads,
              'https://example.com/Person#/properties/name',
              'sh:minCount',
              1,
              'xsd:integer'
            ));
          },
          'name': 'required property produces owl:Restriction with minCardinality',
          'schema': {
            '$id': 'https://example.com/Person',
            'properties': { 'name': { 'type': 'string' } },
            'required': ['name'],
            'type': 'object'
          }
        },
        // Edge cases
        {
          'check': (quads) => {
            assert.ok(
              hasIriQuad(quads, 'https://example.com/Bare', 'rdf:type', 'owl:Class'),
              'bare schema with $id should still emit owl:Class'
            );

            const propQuads = quads.filter((quad) => {
              return quad.predicate === 'rdf:type'
              && quad.object.termType === 'NamedNode'
              && (quad.object.value === 'owl:DatatypeProperty' || quad.object.value === 'owl:ObjectProperty');
            });

            assert.equal(propQuads.length, 0, 'bare schema should not emit property type quads');
          },
          'name': 'schema with $id but no type still emits owl:Class',
          'schema': { '$id': 'https://example.com/Bare' }
        },
        {
          'check': (quads) => {
            assert.ok(hasIriQuad(quads, 'https://example.com/NoProps', 'rdf:type', 'owl:Class'));

            const propQuads = quads.filter((quad) => {
              return quad.predicate === 'rdf:type'
              && quad.object.termType === 'NamedNode'
              && (quad.object.value === 'owl:DatatypeProperty' || quad.object.value === 'owl:ObjectProperty');
            });

            assert.equal(propQuads.length, 0, 'no-properties schema should not emit property type quads');
          },
          'name': 'schema with no properties emits class but no property quads',
          'schema': {
            '$id': 'https://example.com/NoProps',
            'type': 'object'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('string and numeric constraint quads', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/code', 'sh:minLength', 2, 'xsd:integer'),
              'expected sh:minLength = 2'
            );
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/code', 'sh:maxLength', 10, 'xsd:integer'),
              'expected sh:maxLength = 10'
            );
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/code', 'sh:pattern', '^[A-Z]+$', 'xsd:string'),
              'expected sh:pattern = ^[A-Z]+$'
            );
          },
          'name': 'string constraints: minLength, maxLength, pattern',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': {
              'code': {
                'maxLength': 10,
                'minLength': 2,
                'pattern': '^[A-Z]+$',
                'type': 'string'
              }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/score', 'sh:minInclusive', 0, 'xsd:decimal'),
              'expected sh:minInclusive = 0'
            );
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/score', 'sh:maxInclusive', 100, 'xsd:decimal'),
              'expected sh:maxInclusive = 100'
            );
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/delta', 'sh:minExclusive', -1, 'xsd:decimal'),
              'expected sh:minExclusive = -1'
            );
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/T#/properties/delta', 'sh:maxExclusive', 200, 'xsd:decimal'),
              'expected sh:maxExclusive = 200'
            );
          },
          'name': 'numeric constraints: min/maxInclusive, min/maxExclusive',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': {
              'delta': {
                'exclusiveMaximum': 200,
                'exclusiveMinimum': -1,
                'type': 'number'
              },
              'score': {
                'maximum': 100,
                'minimum': 0,
                'type': 'number'
              }
            },
            'type': 'object'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('enum and const quads', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            const oneOfQuads = findQuadsForSubject(quads, 'https://example.com/Status', 'owl:oneOf');

            assert.equal(oneOfQuads.length, 3);
            assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'active', 'xsd:string'));
            assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'inactive', 'xsd:string'));
            assert.ok(hasLiteralQuad(quads, 'https://example.com/Status', 'owl:oneOf', 'pending', 'xsd:string'));
          },
          'name': 'enum produces owl:oneOf',
          'schema': {
            '$id': 'https://example.com/Status',
            'enum': [
              'active',
              'inactive',
              'pending'
            ],
            'type': 'string'
          }
        },
        {
          'check': (quads) => {
            assert.ok(hasLiteralQuad(quads, 'https://example.com/Const', 'owl:hasValue', 'fixed', 'xsd:string'));
          },
          'name': 'const produces owl:hasValue',
          'schema': {
            '$id': 'https://example.com/Const',
            'const': 'fixed',
            'type': 'string'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('composition keywords', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            assert.ok(hasIriQuad(quads, 'https://example.com/Child', 'rdfs:subClassOf', 'https://example.com/Parent'));
          },
          'name': 'allOf produces rdfs:subClassOf',
          'schema': {
            '$id': 'https://example.com/Child',
            'allOf': [{ '$ref': 'https://example.com/Parent' }],
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const eqQuads = findQuadsForSubject(quads, 'https://example.com/Union', 'owl:equivalentClass');

            assert.ok(eqQuads.length >= 2, 'expected >= 2 owl:equivalentClass quads for anyOf');
          },
          'name': 'anyOf produces owl:equivalentClass',
          'schema': {
            '$id': 'https://example.com/Union',
            'anyOf': [
              { 'type': 'string' },
              { 'type': 'number' }
            ]
          }
        },
        {
          'check': (quads) => {
            const eqQuads = findQuadsForSubject(quads, 'https://example.com/Exclusive', 'owl:equivalentClass');

            assert.ok(eqQuads.length >= 2, 'expected >= 2 owl:equivalentClass quads for oneOf');
          },
          'name': 'oneOf produces owl:equivalentClass',
          'schema': {
            '$id': 'https://example.com/Exclusive',
            'oneOf': [
              { 'type': 'string' },
              { 'type': 'boolean' }
            ]
          }
        },
        {
          'check': (quads) => {
            const compQuads = findQuadsForSubject(quads, 'https://example.com/NotArray', 'owl:complementOf');

            assert.ok(compQuads.length > 0);
          },
          'name': 'not produces owl:complementOf',
          'schema': {
            '$id': 'https://example.com/NotArray',
            'not': { 'type': 'array' }
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('conditionals and dependentSchemas', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            const unionQuad = hasBnodeQuad(quads, 'https://example.com/Conditional', 'owl:unionOf');

            assert.ok(unionQuad, 'should have conditional bnode');

            const bId = bnodeId(unionQuad);

            assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Class'));

            for (const pred of [
              'jt:if',
              'jt:then',
              'jt:else'
            ] as const) {
              const found = findQuadsForSubject(quads, bId, pred);

              assert.ok(found.length > 0, `should have ${pred}`);
            }
          },
          'name': 'if/then/else produces owl:unionOf bnode with jt: predicates',
          'schema': {
            '$id': 'https://example.com/Conditional',
            'else': {
              'properties': { 'label': { 'type': 'string' } },
              'type': 'object'
            },
            'if': {
              'properties': { 'kind': { 'const': 'person' } },
              'type': 'object'
            },
            // eslint-disable-next-line unicorn/no-thenable -- JSON Schema 'then' keyword
            'then': {
              'properties': { 'name': { 'type': 'string' } },
              'type': 'object'
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const depUnionQuad = hasBnodeQuad(quads, 'https://example.com/Deps', 'owl:unionOf');

            assert.ok(depUnionQuad, 'should have conditional bnode');

            const depBId = bnodeId(depUnionQuad);

            assert.ok(hasIriQuad(quads, depBId, 'rdf:type', 'owl:Class'));

            const ifQuads = findQuadsForSubject(quads, depBId, 'jt:if');

            assert.ok(ifQuads.length > 0, 'should have jt:if');
          },
          'name': 'dependentSchemas produces conditional bnode with jt:if',
          'schema': {
            '$id': 'https://example.com/Deps',
            'dependentSchemas': {
              'address': {
                'properties': { 'zip': { 'type': 'string' } },
                'type': 'object'
              }
            },
            'properties': { 'address': { 'type': 'string' } },
            'type': 'object'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('contains, prefixItems, and patternProperties', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            const svfQuad = hasBnodeQuad(quads, 'https://example.com/ArrayContains', 'owl:someValuesFrom');

            assert.ok(svfQuad, 'should have someValuesFrom bnode');

            const bId = bnodeId(svfQuad);

            assert.ok(hasIriQuad(quads, bId, 'rdf:type', 'owl:Restriction'));
            assert.ok(hasIriQuad(quads, bId, 'owl:onProperty', 'rdfs:member'));
            assert.ok(hasIriQuad(quads, bId, 'owl:someValuesFrom', 'xsd:decimal'));
          },
          'name': 'contains emits someValuesFrom restriction',
          'schema': {
            '$id': 'https://example.com/ArrayContains',
            'contains': { 'type': 'number' },
            'type': 'array'
          }
        },
        {
          'check': (quads) => {
            assert.ok(hasLiteralQuad(
              quads,
              'https://example.com/ArrayCard',
              'owl:minQualifiedCardinality',
              2,
              'xsd:nonNegativeInteger'
            ));
            assert.ok(hasLiteralQuad(
              quads,
              'https://example.com/ArrayCard',
              'owl:maxQualifiedCardinality',
              5,
              'xsd:nonNegativeInteger'
            ));
          },
          'name': 'minContains/maxContains emit qualified cardinality',
          'schema': {
            '$id': 'https://example.com/ArrayCard',
            'contains': { 'type': 'string' },
            'maxContains': 5,
            'minContains': 2,
            'type': 'array'
          }
        },
        {
          'check': (quads) => {
            const memberQuads = findQuadsForSubject(quads, 'https://example.com/Tuple', 'rdfs:member');

            assert.equal(memberQuads.length, 3);
            assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:string'));
            assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:decimal'));
            assert.ok(hasIriQuad(quads, 'https://example.com/Tuple', 'rdfs:member', 'xsd:boolean'));
          },
          'name': 'prefixItems produce rdfs:member quads',
          'schema': {
            '$id': 'https://example.com/Tuple',
            'prefixItems': [
              { 'type': 'string' },
              { 'type': 'number' },
              { 'type': 'boolean' }
            ],
            'type': 'array'
          }
        },
        {
          'check': (quads) => {
            const shPatternQuads = findQuadsForSubject(quads, 'https://example.com/PatternProps', 'sh:pattern');

            assert.ok(shPatternQuads.length >= 2, `expected at least 2 sh:pattern quads, got ${shPatternQuads.length}`);
            assert.ok(hasLiteralQuad(quads, 'https://example.com/PatternProps', 'sh:pattern', '^x-', 'xsd:string'));
            assert.ok(hasLiteralQuad(quads, 'https://example.com/PatternProps', 'sh:pattern', '^y-', 'xsd:string'));
          },
          'name': 'patternProperties emit sh:pattern quads',
          'schema': {
            '$id': 'https://example.com/PatternProps',
            'patternProperties': {
              '^x-': { 'type': 'string' },
              '^y-': { 'type': 'number' }
            },
            'type': 'object'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('additionalProperties controls sh:closed', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            const closedQuads = findQuadsForSubject(quads, 'https://example.com/Strict', 'sh:closed');

            assert.equal(closedQuads.length, 1, 'sh:closed count for strict');
            assert.ok(hasLiteralQuad(
              quads,
              'https://example.com/Strict',
              'sh:closed',
              'true',
              'xsd:boolean'
            ));
          },
          'name': 'additionalProperties: false emits sh:closed true',
          'schema': {
            '$id': 'https://example.com/Strict',
            'additionalProperties': false,
            'properties': { 'a': { 'type': 'string' } },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const closedQuads = findQuadsForSubject(quads, 'https://example.com/Open', 'sh:closed');

            assert.equal(closedQuads.length, 0, 'sh:closed count for open');
          },
          'name': 'additionalProperties: true does not emit sh:closed',
          'schema': {
            '$id': 'https://example.com/Open',
            'additionalProperties': true,
            'type': 'object'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('annotation predicates', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/RO#/properties/id', 'dash:readOnly', true, 'xsd:boolean'),
              'expected dash:readOnly = true'
            );
          },
          'name': 'readOnly emits dash:readOnly',
          'schema': {
            '$id': 'https://example.com/RO',
            'properties': {
              'id': {
                'readOnly': true,
                'type': 'string'
              }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/WO#/properties/password', 'dash:writeOnly', true, 'xsd:boolean'),
              'expected dash:writeOnly = true'
            );
          },
          'name': 'writeOnly emits dash:writeOnly',
          'schema': {
            '$id': 'https://example.com/WO',
            'properties': {
              'password': {
                'type': 'string',
                'writeOnly': true
              }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            assert.ok(
              hasLiteralQuad(quads, 'https://example.com/Old', 'owl:deprecated', 'true', 'xsd:boolean'),
              'expected owl:deprecated = true'
            );
          },
          'name': 'deprecated emits owl:deprecated',
          'schema': {
            '$id': 'https://example.com/Old',
            'deprecated': true,
            'type': 'string'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });

    void describe('$ref, multi-type, and XSD datatype resolution', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            assert.ok(hasIriQuad(
              quads,
              'https://example.com/T#/properties/friend',
              'rdfs:range',
              'https://example.com/Person'
            ));
          },
          'name': '$ref produces rdfs:range IRI',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': { 'friend': { '$ref': 'https://example.com/Person' } },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const unionOfQuads = findQuadsForSubject(
              quads,
              'https://example.com/T#/properties/value',
              'owl:unionOf'
            );

            assert.ok(unionOfQuads.length > 0, 'should have unionOf quad');

            const listQuad = unionOfQuads.find((quad) => {
              return quad.object.termType === 'List';
            });

            assert.ok(listQuad, 'should have list-type object');

            if (listQuad.object.termType === 'List') {
              const items = listQuad.object.items;

              assert.equal(items.length, 2);
              assert.equal(items[0].termType, 'NamedNode');
              assert.equal(items[1].termType, 'NamedNode');
              assert.equal(items[0].value, 'xsd:string');
              assert.equal(items[1].value, 'xsd:decimal');
            }
          },
          'name': 'multi-type produces owl:unionOf with RDF list',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': {
              'value': {
                'type': [
                  'string',
                  'number'
                ]
              }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            assert.ok(
              hasIriQuad(quads, 'https://example.com/T#/properties/name', 'sh:datatype', 'xsd:string'),
              'expected sh:datatype = xsd:string'
            );
          },
          'name': 'sh:datatype for string property',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': { 'name': { 'type': 'string' } },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            assert.ok(
              hasIriQuad(quads, 'https://example.com/T#/properties/created', 'sh:datatype', 'xsd:dateTime'),
              'expected sh:datatype = xsd:dateTime'
            );
          },
          'name': 'sh:datatype for date-time format resolves to xsd:dateTime',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': {
              'created': {
                'format': 'date-time',
                'type': 'string'
              }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const dtQuads = findQuadsForSubject(
              quads,
              'https://example.com/T#/properties/meta',
              'sh:datatype'
            );

            assert.equal(dtQuads.length, 0);
          },
          'name': 'object type does not emit sh:datatype',
          'schema': {
            '$id': 'https://example.com/T',
            'properties': { 'meta': { 'type': 'object' } },
            'type': 'object'
          }
        }
      ];

      for (const {
        check, name, schema
      } of scenarios) {
        void it(name, () => {
          const quads = tboxQuads(schema);

          check(quads);
        });
      }
    });
  });

  // ---------------------------------------------------------------------------
  // quadsToJsonLdNodes
  // ---------------------------------------------------------------------------

  void describe('quadsToJsonLdNodes', () => {
    const scenarios: Array<{
      'check': (nodes: Array<Record<string, unknown>>) => void;
      'name': string;
      'quads': QuadInterface[];
    }> = [{
      'check': (nodes) => {
        const root = nodes.find((node) => {
          return node['@id'] === 'https://example.com/Thing';
        });
        const nested = nodes.find((node) => {
          return node['@id'] === '_:b1';
        });

        assert.ok(root);
        assert.ok(nested);
        assert.deepEqual(root['ex:child'], { '@id': '_:b1' });
        assert.equal(JSON.stringify(nodes).includes('_:_:b1'), false);
      },
      'name': 'preserves stable blank node identifiers without double-prefixing',
      'quads': [
        {
          'object': {
            'termType': 'BlankNode' as const,
            'value': '_:b1'
          },
          'predicate': 'ex:child',
          'subject': 'https://example.com/Thing'
        },
        {
          'object': {
            'termType': 'NamedNode' as const,
            'value': 'ex:Nested'
          },
          'predicate': 'rdf:type',
          'subject': '_:b1'
        },
        {
          'object': {
            'datatype': {
              'termType': 'NamedNode' as const,
              'value': 'xsd:string'
            },
            'language': '',
            'termType': 'Literal' as const,
            'value': 'nested'
          },
          'predicate': 'ex:value',
          'subject': '_:b1'
        }
      ]
    }];

    for (const {
      check, name, quads
    } of scenarios) {
      void it(name, () => {
        const nodes = Projection.toJsonLdNodes(quads);

        check(nodes);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // ABox tests
  // ---------------------------------------------------------------------------

  void describe('projectAbox — ABox projection', () => {
    void describe('simple instance projection', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'instance': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [
        {
          'check': (quads) => {
            const typeQuads = findQuads(quads, 'rdf:type');

            assert.ok(typeQuads.length > 0, 'should have at least one rdf:type quad');

            const instIRI = typeQuads[0].subject;

            assert.ok(instIRI.startsWith('https://data.example.com/'));
            assert.ok(hasIriQuad(quads, instIRI, 'rdf:type', 'https://example.com/User'));
            assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#name', 'Alice', 'xsd:string'));
            assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#age', 30, 'xsd:integer'));
            assert.ok(hasLiteralQuad(quads, instIRI, 'https://example.com/User#active', true, 'xsd:boolean'));
          },
          'instance': {
            'active': true,
            'age': 30,
            'name': 'Alice'
          },
          'name': 'simple instance produces typed quads with rdf:type and property literals',
          'schema': {
            '$id': 'https://example.com/User',
            'properties': {
              'active': { 'type': 'boolean' },
              'age': { 'type': 'integer' },
              'name': { 'type': 'string' }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const arrTypeQuad = quads.find((quad) => {
              return quad.predicate === 'rdf:type';
            });

            assert.ok(arrTypeQuad, 'should have rdf:type quad');
            const arrInstIRI = arrTypeQuad.subject;
            const tagQuads = findQuadsForSubject(quads, arrInstIRI, 'https://example.com/Tags#tags');

            assert.equal(tagQuads.length, 3);

            const tagValues = new Set(tagQuads
              .filter((quad) => {
                return quad.object.termType === 'Literal';
              })
              .map((quad) => {
                return quad.object.termType === 'Literal' ? quad.object.value : null;
              }));

            assert.ok(tagValues.has('red'));
            assert.ok(tagValues.has('green'));
            assert.ok(tagValues.has('blue'));
          },
          'instance': {
            'tags': [
              'red',
              'green',
              'blue'
            ]
          },
          'name': 'array values produce one quad per element',
          'schema': {
            '$id': 'https://example.com/Tags',
            'properties': {
              'tags': {
                'items': { 'type': 'string' },
                'type': 'array'
              }
            },
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const nullTypeQuad = quads.find((quad) => {
              return quad.predicate === 'rdf:type';
            });

            assert.ok(nullTypeQuad, 'should have rdf:type quad');
            const nullInstIRI = nullTypeQuad.subject;

            assert.ok(hasLiteralQuad(quads, nullInstIRI, 'https://example.com/Nullable#name', 'Alice'));

            const nickQuads = findQuadsForSubject(quads, nullInstIRI, 'https://example.com/Nullable#nickname');

            assert.equal(nickQuads.length, 0);
          },
          'instance': {
            'name': 'Alice',
            'nickname': null
          },
          'name': 'null values are omitted from quads',
          'schema': {
            '$id': 'https://example.com/Nullable',
            'properties': {
              'name': { 'type': 'string' },
              'nickname': { 'type': 'string' }
            },
            'type': 'object'
          }
        },
        // Edge cases
        {
          'check': (quads) => {
            const nonTypeQuads = quads.filter((quad) => {
              return quad.predicate !== 'rdf:type';
            });

            assert.equal(nonTypeQuads.length, 0, 'empty instance should produce no property quads');
          },
          'instance': {},
          'name': 'empty schema projection produces no property quads',
          'schema': {
            '$id': 'https://example.com/EmptyProjection',
            'type': 'object'
          }
        },
        {
          'check': (quads) => {
            const typeQuads = findQuads(quads, 'rdf:type');

            assert.ok(typeQuads.length > 0, 'should still produce rdf:type quad');
          },
          'instance': { 'undeclared': 'value' },
          'name': 'schema with no properties produces only type quad for instance with extra keys',
          'schema': {
            '$id': 'https://example.com/NoPropsSchema',
            'type': 'object'
          }
        }
      ];

      for (const {
        check, instance, name, schema
      } of scenarios) {
        void it(name, () => {
          const graph = new SchemaGraph(schema);
          const quads = Projection.abox(graph, instance, 'https://data.example.com');

          check(quads);
        });
      }
    });

    void describe('nested object projection', () => {
      const scenarios: Array<{
        'check': (quads: QuadInterface[]) => void;
        'instance': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [{
        'check': (quads) => {
          const parentTypeQuads = quads.filter((quad) => {
            return quad.predicate === 'rdf:type'
            && quad.object.termType === 'NamedNode'
            && quad.object.value === 'https://example.com/Parent';
          });

          assert.equal(parentTypeQuads.length, 1);
          const parentIRI = parentTypeQuads[0].subject;

          const addrQuads = findQuadsForSubject(quads, parentIRI, 'https://example.com/Parent#address');

          assert.equal(addrQuads.length, 1);
          assert.equal(addrQuads[0].object.termType, 'NamedNode');

          const nestedIRI = addrQuads[0].object.value;

          assert.ok(
            hasLiteralQuad(quads, nestedIRI, 'https://example.com/Parent#/properties/address#street', 'Springfield', 'xsd:string')
            || hasLiteralQuad(quads, nestedIRI, 'https://example.com/Parent#/properties/address#city', 'Springfield', 'xsd:string')
            || quads.some((quad) => {
              return quad.subject === nestedIRI
              && quad.predicate.includes('city')
              && quad.object.termType === 'Literal'
              && quad.object.value === 'Springfield';
            }),
            'nested instance should have city property'
          );
        },
        'instance': {
          'address': {
            'city': 'Springfield',
            'street': '123 Main St'
          },
          'name': 'Bob'
        },
        'name': 'nested object produces linked instance quads',
        'schema': {
          '$id': 'https://example.com/Parent',
          'properties': {
            'address': {
              'properties': {
                'city': { 'type': 'string' },
                'street': { 'type': 'string' }
              },
              'type': 'object'
            },
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      }];

      for (const {
        check, instance, name, schema
      } of scenarios) {
        void it(name, () => {
          const graph = new SchemaGraph(schema);
          const quads = Projection.abox(graph, instance, 'https://data.example.com');

          check(quads);
        });
      }
    });

    void describe('TBox + ABox coherence', () => {
      const scenarios: Array<{
        'check': (tbox: QuadInterface[], abox: QuadInterface[]) => void;
        'instance': Record<string, unknown>;
        'name': string;
        'schema': Record<string, unknown>;
      }> = [{
        'check': (tbox, abox) => {
          const tboxClasses = new Set(tbox
            .filter((quad) => {
              return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode' && quad.object.value === 'owl:Class';
            })
            .map((quad) => {
              return quad.subject;
            }));

          const aboxTypes = abox
            .filter((quad) => {
              return quad.predicate === 'rdf:type' && quad.object.termType === 'NamedNode';
            })
            .map((quad) => {
              return quad.object.termType === 'NamedNode' ? quad.object.value : '';
            });

          for (const aboxType of aboxTypes) {
            assert.ok(
              tboxClasses.has(aboxType),
              `ABox type ${aboxType} should be declared as owl:Class in TBox`
            );
          }

          const aboxPropPredicates = abox
            .filter((quad) => {
              return quad.predicate !== 'rdf:type';
            })
            .map((quad) => {
              return quad.predicate;
            });

          for (const pred of aboxPropPredicates) {
            assert.ok(
              pred.startsWith('https://example.com/Item'),
              `ABox property predicate ${pred} should reference the schema class`
            );
          }
        },
        'instance': {
          'count': 5,
          'label': 'Widget'
        },
        'name': 'instance types match declared classes',
        'schema': {
          '$id': 'https://example.com/Item',
          'properties': {
            'count': { 'type': 'integer' },
            'label': { 'type': 'string' }
          },
          'required': ['label'],
          'type': 'object'
        }
      }];

      for (const {
        check, instance, name, schema
      } of scenarios) {
        void it(name, () => {
          const graph = new SchemaGraph(schema);
          const tbox = Projection.graph(graph);
          const abox = Projection.abox(graph, instance, 'https://data.example.com');

          check(tbox, abox);
        });
      }
    });
  });
}

// ===========================================================================
// Source: quadRoundTrip.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

  const SimpleSchema = {
    '$id': 'https://example.com/Simple',
    'properties': { 'label': { 'type': 'string' } },
    'required': ['label'],
    'type': 'object'
  } as const;

  const AllScalarsSchema = {
    '$id': 'https://example.com/AllScalars',
    'properties': {
      'active': { 'type': 'boolean' },
      'count': { 'type': 'integer' },
      'label': { 'type': 'string' },
      'score': { 'type': 'number' }
    },
    'required': [
      'active',
      'count',
      'label',
      'score'
    ],
    'type': 'object'
  } as const;

  const PersonSchema = {
    '$defs': {
      'Address': {
        'properties': {
          'city': { 'type': 'string' },
          'zip': { 'type': 'string' }
        },
        'required': [
          'city',
          'zip'
        ],
        'type': 'object'
      }
    },
    '$id': 'https://example.com/Person',
    'properties': {
      'address': { '$ref': '#/$defs/Address' },
      'name': { 'type': 'string' }
    },
    'required': [
      'address',
      'name'
    ],
    'type': 'object'
  } as const;

  const TagListSchema = {
    '$id': 'https://example.com/TagList',
    'properties': {
      'tags': {
        'items': { 'type': 'string' },
        'type': 'array'
      },
      'title': { 'type': 'string' }
    },
    'required': [
      'tags',
      'title'
    ],
    'type': 'object'
  } as const;

  const WithDefaultsSchema = {
    '$id': 'https://example.com/WithDefaults',
    'properties': {
      'color': {
        'default': 'blue',
        'type': 'string'
      },
      'enabled': {
        'default': true,
        'type': 'boolean'
      },
      'name': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const OptionalPropsSchema = {
    '$id': 'https://example.com/OptionalProps',
    'properties': {
      'bio': { 'type': 'string' },
      'name': { 'type': 'string' },
      'nickname': { 'type': 'string' }
    },
    'required': ['name'],
    'type': 'object'
  } as const;

  const EmptyObjectSchema = {
    '$id': 'https://example.com/EmptyObject',
    'properties': { 'note': { 'type': 'string' } },
    'type': 'object'
  } as const;

  const DeeplyNestedSchema = {
    '$defs': {
      'Inner': {
        'properties': { 'value': { 'type': 'string' } },
        'required': ['value'],
        'type': 'object'
      },
      'Middle': {
        'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
        'required': ['inner'],
        'type': 'object'
      }
    },
    '$id': 'https://example.com/DeeplyNested',
    'properties': { 'middle': { '$ref': '#/$defs/Middle' } },
    'required': ['middle'],
    'type': 'object'
  } as const;

  const EnumSchema = {
    '$id': 'https://example.com/WithEnum',
    'properties': {
      'status': {
        'enum': [
          'active',
          'inactive',
          'pending'
        ],
        'type': 'string'
      }
    },
    'required': ['status'],
    'type': 'object'
  } as const;

  const AllOptionalSchema = {
    '$id': 'https://example.com/AllOptional',
    'properties': {
      'bio': { 'type': 'string' },
      'email': { 'type': 'string' },
      'name': { 'type': 'string' }
    },
    'type': 'object'
  } as const;

  const BASE_IRI = 'https://example.com';

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function projectAndLift(
    jt: JsonTology,
    schema: Record<string, unknown> & { '$id': string },
    data: unknown
  ): unknown[] {
    const quads = jt.materializer.projectAbox(schema, data, BASE_IRI);

    return jt.fromQuads(schema.$id, quads);
  }

  // ---------------------------------------------------------------------------
  // Simple round-trip scenarios
  // ---------------------------------------------------------------------------

  interface SimpleRoundTripScenario {
    'check': (original: Record<string, unknown>, roundTripped: Record<string, unknown>) => void;
    'input': Record<string, unknown>;
    'name': string;
    'schema': Record<string, unknown> & { readonly '$id': string };
    'schemas': ReadonlyArray<Record<string, unknown>>;
  }

  const simpleRoundTripScenarios: SimpleRoundTripScenario[] = [
    {
      'check': (_original, output) => {
        assert.equal(output.label, 'hello', 'simple object — label');
      },
      'input': { 'label': 'hello' },
      'name': 'round-trips a simple object',
      'schema': SimpleSchema,
      'schemas': [SimpleSchema]
    },
    {
      'check': (_original, output) => {
        assert.equal(output.label, 'test', 'all scalars — label');
        assert.equal(output.count, 42, 'all scalars — count');
        assert.equal(typeof output.count, 'number', 'all scalars — count type');
        assert.equal(output.score, 3.14, 'all scalars — score');
        assert.equal(typeof output.score, 'number', 'all scalars — score type');
        assert.equal(output.active, false, 'all scalars — active');
        assert.equal(typeof output.active, 'boolean', 'all scalars — active type');
      },
      'input': {
        'active': false,
        'count': 42,
        'label': 'test',
        'score': 3.14
      },
      'name': 'round-trips all scalar types: string, number, integer, boolean',
      'schema': AllScalarsSchema,
      'schemas': [AllScalarsSchema]
    }
  ];

  void describe('quad round-trip: simple scenarios', () => {
    for (const {
      check, input, name, schema, schemas
    } of simpleRoundTripScenarios) {
      void it(name, () => {
        const jt = JsonTology.create({
          'baseIRI': BASE_IRI,
          'schemas': schemas
        });
        const results = projectAndLift(jt, schema, input);

        assert.equal(results.length, 1, `${name} — result count`);
        const output = results[0] as Record<string, unknown>;

        check(input, output);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Nested/structured round-trip scenarios
  // ---------------------------------------------------------------------------

  interface NestedRoundTripScenario {
    'check': (original: Record<string, unknown>, roundTripped: Record<string, unknown>) => void;
    'input': Record<string, unknown>;
    'name': string;
    'schema': Record<string, unknown> & { readonly '$id': string };
    'schemas': ReadonlyArray<Record<string, unknown>>;
  }

  const nestedRoundTripScenarios: NestedRoundTripScenario[] = [
    {
      'check': (_original, output) => {
        assert.equal(output.name, 'Alice', 'nested $ref — name');
        const addr = output.address as Record<string, unknown>;

        assert.equal(addr.city, 'Berlin', 'nested $ref — city');
        assert.equal(addr.zip, '10115', 'nested $ref — zip');
      },
      'input': {
        'address': {
          'city': 'Berlin',
          'zip': '10115'
        },
        'name': 'Alice'
      },
      'name': 'round-trips an object with a nested $ref',
      'schema': PersonSchema,
      'schemas': [PersonSchema]
    },
    {
      'check': (_original, output) => {
        assert.equal(output.title, 'Sample', 'array property — title');
        assert.ok(Array.isArray(output.tags), 'array property — tags is array');
        assert.deepEqual((output.tags as string[]).sort(), [
          'alpha',
          'beta',
          'gamma'
        ], 'array property — tags values');
      },
      'input': {
        'tags': [
          'alpha',
          'beta',
          'gamma'
        ],
        'title': 'Sample'
      },
      'name': 'round-trips an object with an array property',
      'schema': TagListSchema,
      'schemas': [TagListSchema]
    },
    {
      'check': (_original, output) => {
        const middle = output.middle as Record<string, unknown>;
        const inner = middle.inner as Record<string, unknown>;

        assert.equal(inner.value, 'deep', 'deeply nested — value');
      },
      'input': { 'middle': { 'inner': { 'value': 'deep' } } },
      'name': 'round-trips a deeply nested structure (3+ levels)',
      'schema': DeeplyNestedSchema,
      'schemas': [DeeplyNestedSchema]
    }
  ];

  void describe('quad round-trip: nested/structured scenarios', () => {
    for (const {
      check, input, name, schema, schemas
    } of nestedRoundTripScenarios) {
      void it(name, () => {
        const jt = JsonTology.create({
          'baseIRI': BASE_IRI,
          'schemas': schemas
        });
        const results = projectAndLift(jt, schema, input);

        assert.equal(results.length, 1, `${name} — result count`);
        const output = results[0] as Record<string, unknown>;

        check(input, output);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Special-case round-trip scenarios
  // ---------------------------------------------------------------------------

  interface SpecialRoundTripScenario {
    'check': (original: Record<string, unknown>, results: unknown[], jt: JsonTology) => void;
    'input': Record<string, unknown>;
    'name': string;
    'schema': Record<string, unknown> & { readonly '$id': string };
    'schemas': ReadonlyArray<Record<string, unknown>>;
    'useMaterialize'?: boolean;
  }

  const specialRoundTripScenarios: SpecialRoundTripScenario[] = [
    {
      'check': (_original, results) => {
        assert.equal(results.length, 1, 'defaults — result count');
        const output = results[0] as Record<string, unknown>;

        assert.equal(output.name, 'Test', 'defaults — name');
        assert.equal(output.color, 'blue', 'defaults — color');
        assert.equal(output.enabled, true, 'defaults — enabled');
      },
      'input': { 'name': 'Test' },
      'name': 'preserves defaults through materialize then round-trip',
      'schema': WithDefaultsSchema,
      'schemas': [WithDefaultsSchema],
      'useMaterialize': true
    },
    {
      'check': (_original, results) => {
        assert.equal(results.length, 1, 'optional omitted — result count');
        const output = results[0] as Record<string, unknown>;

        assert.equal(output.name, 'Alice', 'optional omitted — name');
        assert.equal('bio' in output, false, 'optional omitted — bio absent');
        assert.equal('nickname' in output, false, 'optional omitted — nickname absent');
      },
      'input': { 'name': 'Alice' },
      'name': 'omits absent optional properties after round-trip',
      'schema': OptionalPropsSchema,
      'schemas': [OptionalPropsSchema]
    },
    {
      'check': (_original, results) => {
        assert.equal(results.length, 1, 'empty object — result count');
        const output = results[0] as Record<string, unknown>;

        assert.equal('note' in output, false, 'empty object — note absent');
      },
      'input': {},
      'name': 'round-trips an empty object with no required properties',
      'schema': EmptyObjectSchema,
      'schemas': [EmptyObjectSchema]
    },
    // Edge cases
    {
      'check': (_original, results) => {
        assert.equal(results.length, 1, 'all-optional empty — result count');
        const output = results[0] as Record<string, unknown>;

        assert.equal('name' in output, false, 'all-optional empty — name absent');
        assert.equal('email' in output, false, 'all-optional empty — email absent');
        assert.equal('bio' in output, false, 'all-optional empty — bio absent');
      },
      'input': {},
      'name': 'all-optional properties with missing values round-trip as empty',
      'schema': AllOptionalSchema,
      'schemas': [AllOptionalSchema]
    },
    {
      'check': (_original, results) => {
        assert.equal(results.length, 1, 'all-optional partial — result count');
        const output = results[0] as Record<string, unknown>;

        assert.equal(output.name, 'Bob', 'all-optional partial — name');
        assert.equal('email' in output, false, 'all-optional partial — email absent');
        assert.equal('bio' in output, false, 'all-optional partial — bio absent');
      },
      'input': { 'name': 'Bob' },
      'name': 'all-optional properties with partial values',
      'schema': AllOptionalSchema,
      'schemas': [AllOptionalSchema]
    }
  ];

  void describe('quad round-trip: special cases', () => {
    for (const {
      check, input, name, schema, schemas, useMaterialize
    } of specialRoundTripScenarios) {
      void it(name, () => {
        const jt = JsonTology.create({
          'baseIRI': BASE_IRI,
          'schemas': schemas
        });

        const data = useMaterialize === true
          ? jt.materialize(schema, input)
          : input;

        const results = projectAndLift(jt, schema, data);

        check(input, results, jt);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Multi-instance and enum round-trip scenarios
  // ---------------------------------------------------------------------------

  interface MultiEnumScenario {
    'check': (jt: JsonTology) => void;
    'name': string;
    'schemas': ReadonlyArray<Record<string, unknown>>;
  }

  const multiEnumScenarios: MultiEnumScenario[] = [
    {
      'check': (jt) => {
        const schemaRef = SimpleSchema as unknown as Record<string, unknown> & { '$id': string };
        const quads1 = jt.materializer.projectAbox(schemaRef, { 'label': 'first' }, BASE_IRI);
        const quads2 = jt.materializer.projectAbox(schemaRef, { 'label': 'second' }, BASE_IRI);
        const quads3 = jt.materializer.projectAbox(schemaRef, { 'label': 'third' }, BASE_IRI);
        const allQuads = [
          ...quads1,
          ...quads2,
          ...quads3
        ];
        const results = jt.fromQuads(SimpleSchema.$id, allQuads);

        assert.equal(results.length, 3, 'multi-instance — result count');
        const labels = (results as Array<Record<string, unknown>>)
          .map((result) => {
            return result.label;
          })
          .sort((left, right) => {
            return String(left).localeCompare(String(right));
          });

        assert.deepEqual(labels, [
          'first',
          'second',
          'third'
        ], 'multi-instance — labels');
      },
      'name': 'round-trips multiple instances from the same schema',
      'schemas': [SimpleSchema]
    },
    {
      'check': (jt) => {
        const enumValues = [
          'active',
          'inactive',
          'pending'
        ] as const;

        for (const status of enumValues) {
          const input = { 'status': status };
          const results = projectAndLift(
            jt,
            EnumSchema,
            input
          );

          assert.equal(results.length, 1, `enum ${status} — result count`);
          const output = results[0] as Record<string, unknown>;

          assert.equal(output.status, status, `enum ${status} — value`);
        }
      },
      'name': 'round-trips an object with an enum property',
      'schemas': [EnumSchema]
    },
    // Edge case
    {
      'check': (jt) => {
        const schemaRef = EmptyObjectSchema as unknown as Record<string, unknown> & { '$id': string };
        const results = projectAndLift(jt, schemaRef, {});

        assert.equal(results.length, 1, 'empty object multi — result count');
        const output = results[0] as Record<string, unknown>;

        assert.equal('note' in output, false, 'empty object multi — note absent');
      },
      'name': 'empty object round-trip produces valid lift result',
      'schemas': [EmptyObjectSchema]
    }
  ];

  void describe('quad round-trip: multi-instance and enum', () => {
    for (const {
      check, name, schemas
    } of multiEnumScenarios) {
      void it(name, () => {
        const jt = JsonTology.create({
          'baseIRI': BASE_IRI,
          'schemas': schemas
        });

        check(jt);
      });
    }
  });
}

// ===========================================================================
// Source: roundTrip.test.ts
// ===========================================================================
{
// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

  const serializer = new GraphSchemaSerializer();

  function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
    Reflect.set(target, key, value);

    return target;
  }

  const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

  function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
    setSchemaKey(target, thenKeyword, value);

    return target;
  }

  function roundtrip(input: Record<string, unknown>): Record<string, unknown> {
    const graph = new SchemaGraph(input);

    return serializer.serialize(graph);
  }

  function relationKey(rel: { 'predicate': string;
    'target': unknown }): { 'pred': string;
    'tgt': string } {
    const target = rel.target;

    return {
      'pred': rel.predicate,
      'tgt': typeof target === 'string' ? target : (target as { 'id': string }).id
    };
  }

  function sortRelations(array: Array<{ 'pred': string;
    'tgt': string }>): Array<{ 'pred': string;
    'tgt': string }> {
    return [...array].sort((left, right) => {
      return left.pred.localeCompare(right.pred) || left.tgt.localeCompare(right.tgt);
    });
  }

  function assertRoundTrip(schema: Record<string, unknown>, label?: string): void {
    const tag = label ?? schema.$id ?? 'anonymous';
    const graph1 = new SchemaGraph(schema);
    const rt = serializer.serialize(graph1);

    assert.deepEqual(rt, schema, `${String(tag)}: first round-trip schema mismatch`);

    const graph2 = new SchemaGraph(rt);
    const rels1 = sortRelations(graph1.allRelations().map((item) => {
      return relationKey(item);
    }));
    const rels2 = sortRelations(graph2.allRelations().map((item) => {
      return relationKey(item);
    }));

    assert.deepEqual(rels1, rels2, `${String(tag)}: relation mismatch after round-trip`);

    const rt2 = serializer.serialize(graph2);

    assert.deepEqual(rt2, rt, `${String(tag)}: second round-trip not idempotent`);
  }

  // ---------------------------------------------------------------------------
  // Scenario types
  // ---------------------------------------------------------------------------

  interface RoundTripScenario {
    'check': (schema: Record<string, unknown>) => void;
    'name': string;
    'schema': Record<string, unknown>;
  }

  // ---------------------------------------------------------------------------
  // Tests: primitive types
  // ---------------------------------------------------------------------------

  void describe('Round-trip: primitive types', () => {
    const scenarios: RoundTripScenario[] = [
      ...[
        'string',
        'number',
        'integer',
        'boolean',
        'null'
      ].map((typeName): RoundTripScenario => {
        return {
          'check': (schema) => {
            assertRoundTrip(schema);
          },
          'name': `primitive type: ${typeName}`,
          'schema': {
            '$id': `https://rt.test/${typeName}`,
            'type': typeName
          }
        };
      }),
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'multi-type [string, null]',
        'schema': {
          '$id': 'https://rt.test/multi-type',
          'type': [
            'string',
            'null'
          ]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'const string value',
        'schema': {
          '$id': 'https://rt.test/Const',
          'const': 'fixed'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'enum with type',
        'schema': {
          '$id': 'https://rt.test/Enum',
          'enum': [
            'red',
            'green',
            'blue'
          ],
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'default numeric value',
        'schema': {
          '$id': 'https://rt.test/Default',
          'default': 42,
          'type': 'number'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'const null',
        'schema': {
          '$id': 'https://rt.test/ConstNull',
          'const': null
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'default false',
        'schema': {
          '$id': 'https://rt.test/DefaultFalse',
          'default': false,
          'type': 'boolean'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'default zero',
        'schema': {
          '$id': 'https://rt.test/DefaultZero',
          'default': 0,
          'type': 'number'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'enum with mixed types',
        'schema': {
          '$id': 'https://rt.test/EnumMixed',
          'enum': [
            'active',
            42,
            null,
            true
          ]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'string constraints (minLength, maxLength, pattern)',
        'schema': {
          '$id': 'https://rt.test/StringConstraints',
          'maxLength': 100,
          'minLength': 1,
          'pattern': '^[A-Z]',
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'format constraint',
        'schema': {
          '$id': 'https://rt.test/Format',
          'format': 'email',
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'numeric constraints (min, max, multipleOf)',
        'schema': {
          '$id': 'https://rt.test/NumericConstraints',
          'maximum': 100,
          'minimum': 0,
          'multipleOf': 5,
          'type': 'number'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'exclusive numeric constraints',
        'schema': {
          '$id': 'https://rt.test/ExclusiveNumeric',
          'exclusiveMaximum': 200,
          'exclusiveMinimum': -1,
          'type': 'number'
        }
      },
      // Edge cases
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'empty enum array',
        'schema': {
          '$id': 'https://rt.test/EmptyEnum',
          'enum': [],
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'default empty string',
        'schema': {
          '$id': 'https://rt.test/DefaultEmptyStr',
          'default': '',
          'type': 'string'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: objects and arrays
  // ---------------------------------------------------------------------------

  void describe('Round-trip: objects', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'simple object with required',
        'schema': {
          '$id': 'https://rt.test/Object',
          'properties': {
            'age': { 'type': 'number' },
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'strict object (additionalProperties: false)',
        'schema': {
          '$id': 'https://rt.test/Strict',
          'additionalProperties': false,
          'properties': { 'a': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'additionalProperties as schema',
        'schema': {
          '$id': 'https://rt.test/AdditionalSchema',
          'additionalProperties': { 'type': 'string' },
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'object constraints (min/maxProperties)',
        'schema': {
          '$id': 'https://rt.test/ObjConstraints',
          'maxProperties': 10,
          'minProperties': 1,
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'propertyNames constraint',
        'schema': {
          '$id': 'https://rt.test/PropertyNames',
          'propertyNames': {
            'pattern': '^[a-z]+$',
            'type': 'string'
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'patternProperties',
        'schema': {
          '$id': 'https://rt.test/PatternProps',
          'patternProperties': {
            '^I_': { 'type': 'integer' },
            '^S_': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'array with items',
        'schema': {
          '$id': 'https://rt.test/Array',
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'tuple with prefixItems',
        'schema': {
          '$id': 'https://rt.test/Tuple',
          'prefixItems': [
            { 'type': 'string' },
            { 'type': 'number' },
            { 'type': 'boolean' }
          ],
          'type': 'array'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'contains with cardinality',
        'schema': {
          '$id': 'https://rt.test/Contains',
          'contains': { 'type': 'string' },
          'maxContains': 5,
          'minContains': 2,
          'type': 'array'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'array constraints (min/maxItems, uniqueItems)',
        'schema': {
          '$id': 'https://rt.test/ArrayConstraints',
          'items': { 'type': 'number' },
          'maxItems': 100,
          'minItems': 1,
          'type': 'array',
          'uniqueItems': true
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'unevaluatedItems: false',
        'schema': {
          '$id': 'https://rt.test/UnevaluatedItems',
          'prefixItems': [{ 'type': 'string' }],
          'type': 'array',
          'unevaluatedItems': false
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'additionalItems as schema',
        'schema': {
          '$id': 'https://rt.test/AdditionalItems',
          'additionalItems': { 'type': 'boolean' },
          'type': 'array'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'additionalItems: false with prefixItems',
        'schema': {
          '$id': 'https://rt.test/AdditionalItemsFalse',
          'additionalItems': false,
          'prefixItems': [
            { 'type': 'string' },
            { 'type': 'number' }
          ],
          'type': 'array'
        }
      },
      // Edge cases
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'object with no properties',
        'schema': {
          '$id': 'https://rt.test/EmptyObj',
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'empty array schema with no items',
        'schema': {
          '$id': 'https://rt.test/EmptyArray',
          'type': 'array'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: composition
  // ---------------------------------------------------------------------------

  void describe('Round-trip: composition', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'allOf composition',
        'schema': {
          '$id': 'https://rt.test/AllOf',
          'allOf': [
            {
              'properties': { 'a': { 'type': 'string' } },
              'required': ['a'],
              'type': 'object'
            },
            {
              'properties': { 'b': { 'type': 'number' } },
              'required': ['b'],
              'type': 'object'
            }
          ]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'anyOf composition',
        'schema': {
          '$id': 'https://rt.test/AnyOf',
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'oneOf composition',
        'schema': {
          '$id': 'https://rt.test/OneOf',
          'oneOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'not composition',
        'schema': {
          '$id': 'https://rt.test/Not',
          'not': { 'type': 'array' }
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'if/then/else conditional',
        'schema': setThenKeyword({
          '$id': 'https://rt.test/Conditional',
          'else': { 'required': ['kind'] },
          'if': { 'properties': { 'kind': { 'const': 'special' } } },
          'properties': {
            'kind': { 'type': 'string' },
            'value': { 'type': 'number' }
          },
          'type': 'object'
        }, { 'required': ['value'] })
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'if/then without else',
        'schema': setThenKeyword({
          '$id': 'https://rt.test/IfThen',
          'if': { 'properties': { 'kind': { 'const': 'a' } } },
          'type': 'object'
        }, { 'properties': { 'aValue': { 'type': 'number' } } })
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'dependentRequired',
        'schema': {
          '$id': 'https://rt.test/DepRequired',
          'dependentRequired': { 'creditCard': ['billingAddress'] },
          'properties': {
            'billingAddress': { 'type': 'string' },
            'creditCard': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'dependentSchemas',
        'schema': {
          '$id': 'https://rt.test/DepSchemas',
          'dependentSchemas': {
            'credit_card': {
              'properties': { 'billing_address': { 'type': 'string' } },
              'required': ['billing_address']
            }
          },
          'properties': {
            'billing_address': { 'type': 'string' },
            'credit_card': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'discriminator with mapping',
        'schema': {
          '$id': 'https://rt.test/DiscMap',
          'discriminator': {
            'mapping': {
              'cat': '#/$defs/Cat',
              'dog': '#/$defs/Dog'
            },
            'propertyName': 'kind'
          },
          'oneOf': [
            {
              'properties': { 'kind': { 'const': 'cat' } },
              'type': 'object'
            },
            {
              'properties': { 'kind': { 'const': 'dog' } },
              'type': 'object'
            }
          ]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'discriminator without mapping',
        'schema': {
          '$id': 'https://rt.test/DiscNoMap',
          'discriminator': { 'propertyName': 'kind' },
          'oneOf': [{
            'properties': { 'kind': { 'const': 'a' } },
            'type': 'object'
          }]
        }
      },
      // Edge cases
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'allOf with single subschema',
        'schema': {
          '$id': 'https://rt.test/AllOfSingle',
          'allOf': [{ 'type': 'string' }]
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'not wrapping a not (double negation)',
        'schema': {
          '$id': 'https://rt.test/NotNot',
          'not': { 'not': { 'type': 'string' } }
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: refs and anchors
  // ---------------------------------------------------------------------------

  void describe('Round-trip: refs and anchors', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'local $ref to $defs',
        'schema': {
          '$defs': {
            'Child': {
              'properties': { 'name': { 'type': 'string' } },
              'required': ['name'],
              'type': 'object'
            }
          },
          '$id': 'https://rt.test/LocalRef',
          'properties': { 'child': { '$ref': '#/$defs/Child' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'external $ref',
        'schema': {
          '$id': 'https://rt.test/ExternalRef',
          'properties': { 'parent': { '$ref': 'https://example.com/Parent' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$anchor',
        'schema': {
          '$id': 'https://rt.test/Anchor',
          'properties': {
            'tag': {
              '$anchor': 'tag-node',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$dynamicAnchor and $dynamicRef',
        'schema': {
          '$dynamicAnchor': 'node',
          '$id': 'https://rt.test/Dynamic',
          'properties': {
            'child': { '$dynamicRef': '#node' },
            'value': { 'type': 'number' }
          },
          'required': ['value'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'multiple $defs with anchors and dynamic anchors',
        'schema': {
          '$defs': {
            'Bar': {
              '$dynamicAnchor': 'DynBar',
              'properties': { 'score': { 'type': 'number' } },
              'type': 'object'
            },
            'Foo': {
              '$anchor': 'MyAnchor',
              'properties': { 'label': { 'type': 'string' } },
              'required': ['label'],
              'type': 'object'
            }
          },
          '$id': 'https://rt.test/MultiDefs',
          'properties': {
            'anchorRef': { '$ref': '#MyAnchor' },
            'localRef': { '$ref': '#/$defs/Foo' }
          },
          'required': ['localRef'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'legacy definitions keyword',
        'schema': {
          '$id': 'https://rt.test/Definitions',
          'definitions': {
            'Addr': {
              'properties': { 'street': { 'type': 'string' } },
              'type': 'object'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$recursiveAnchor and $recursiveRef',
        'schema': {
          '$id': 'https://rt.test/Recursive',
          '$recursiveAnchor': true,
          'properties': {
            'children': {
              'items': { '$recursiveRef': '#' },
              'type': 'array'
            }
          },
          'type': 'object'
        }
      },
      // Edge cases
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$defs with no references to them',
        'schema': {
          '$defs': { 'Unused': { 'type': 'string' } },
          '$id': 'https://rt.test/UnusedDefs',
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'self-referencing $ref to root',
        'schema': {
          '$id': 'https://rt.test/SelfRef',
          'properties': { 'child': { '$ref': 'https://rt.test/SelfRef' } },
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: metadata
  // ---------------------------------------------------------------------------

  void describe('Round-trip: metadata', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'title and description',
        'schema': {
          '$id': 'https://rt.test/Metadata',
          'description': 'Represents a person',
          'properties': { 'name': { 'type': 'string' } },
          'title': 'A Person',
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'deprecated flag',
        'schema': {
          '$id': 'https://rt.test/Deprecated',
          'deprecated': true,
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'readOnly and writeOnly',
        'schema': {
          '$id': 'https://rt.test/ReadWrite',
          'properties': {
            'id': {
              'readOnly': true,
              'type': 'string'
            },
            'secret': {
              'type': 'string',
              'writeOnly': true
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'contentEncoding and contentMediaType',
        'schema': {
          '$id': 'https://rt.test/Content',
          'contentEncoding': 'base64',
          'contentMediaType': 'text/plain',
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$comment on root and nested',
        'schema': {
          '$comment': 'Root comment',
          '$id': 'https://rt.test/Comment',
          'properties': {
            'name': {
              '$comment': 'Name field comment',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'examples on root',
        'schema': {
          '$id': 'https://rt.test/Examples',
          'examples': [
            'alpha',
            'beta'
          ],
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'examples on nested properties',
        'schema': {
          '$id': 'https://rt.test/NestedExamples',
          'properties': {
            'name': {
              'examples': [
                'Alice',
                'Bob'
              ],
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$schema dialect',
        'schema': {
          '$id': 'https://rt.test/Dialect',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': '$vocabulary',
        'schema': {
          '$id': 'https://rt.test/Vocabulary',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          '$vocabulary': {
            'https://json-schema.org/draft/2020-12/vocab/applicator': true,
            'https://json-schema.org/draft/2020-12/vocab/core': true,
            'https://json-schema.org/draft/2020-12/vocab/validation': true
          },
          'type': 'string'
        }
      },
      // Edge cases
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'multiple metadata fields combined',
        'schema': {
          '$comment': 'top-level comment',
          '$id': 'https://rt.test/MultiMeta',
          'description': 'A description',
          'title': 'Multi Meta',
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'deprecated with readOnly on same property',
        'schema': {
          '$id': 'https://rt.test/DeprecatedReadOnly',
          'properties': {
            'legacy': {
              'deprecated': true,
              'readOnly': true,
              'type': 'string'
            }
          },
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: boolean schemas
  // ---------------------------------------------------------------------------

  void describe('Round-trip: boolean schemas', () => {
    const boolAllOfScenarios: Array<{ 'allOfValue': unknown[];
      'id': string;
      'name': string; }> = [
      {
        'allOfValue': [true],
        'id': 'https://rt.test/BoolTrue',
        'name': 'boolean true in allOf'
      },
      {
        'allOfValue': [false],
        'id': 'https://rt.test/BoolFalse',
        'name': 'boolean false in allOf'
      }
    ];

    for (const {
      allOfValue, id, name
    } of boolAllOfScenarios) {
      void it(name, () => {
        const schema: Record<string, unknown> = {
          '$id': id,
          'allOf': allOfValue
        };
        const graph = new SchemaGraph(schema);
        const rt = serializer.serialize(graph);

        assert.deepEqual(rt.allOf, allOfValue);
      });
    }

    const boolKeywordScenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'unevaluatedProperties: false',
        'schema': {
          '$id': 'https://rt.test/UnevalPropsFalse',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object',
          'unevaluatedProperties': false
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'items: false with prefixItems',
        'schema': {
          '$id': 'https://rt.test/ItemsFalse',
          'items': false,
          'prefixItems': [
            { 'type': 'string' },
            { 'type': 'number' }
          ],
          'type': 'array'
        }
      }
    ];

    for (const {
      check, name, schema
    } of boolKeywordScenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: extension and custom keywords
  // ---------------------------------------------------------------------------

  void describe('Round-trip: extension and custom keywords', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'rdfs:domain and rdfs:range',
        'schema': {
          '$id': 'https://rt.test/DomainRange',
          'rdfs:domain': 'https://example.com/Person',
          'rdfs:range': 'http://www.w3.org/2001/XMLSchema#string',
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'disjointWith',
        'schema': {
          '$id': 'https://rt.test/Disjoint',
          'disjointWith': 'https://example.com/Cat',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'equivalentTo',
        'schema': {
          '$id': 'https://rt.test/Equivalent',
          'equivalentTo': 'https://example.com/Human',
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'inverseOf on property',
        'schema': {
          '$id': 'https://rt.test/InverseOf',
          'properties': {
            'owns': {
              'inverseOf': 'https://example.com/Thing#ownedBy',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'transitive property',
        'schema': {
          '$id': 'https://rt.test/Transitive',
          'properties': {
            'ancestor': {
              'transitive': true,
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'symmetric property',
        'schema': {
          '$id': 'https://rt.test/Symmetric',
          'properties': {
            'sibling': {
              'symmetric': true,
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'custom x-* keywords on root',
        'schema': {
          '$id': 'https://rt.test/CustomRoot',
          'evenNumber': true,
          'type': 'integer',
          'x-ui-widget': 'slider',
          'x-validation-group': 'pricing'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'custom x-* keywords on properties',
        'schema': {
          '$id': 'https://rt.test/CustomProps',
          'properties': {
            'price': {
              'minimum': 0,
              'type': 'number',
              'x-currency': 'USD'
            }
          },
          'type': 'object',
          'x-table': 'products'
        }
      },
      // Edge cases
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'multiple x-* keywords without standard constraints',
        'schema': {
          '$id': 'https://rt.test/CustomOnly',
          'x-custom-a': 'alpha',
          'x-custom-b': 123,
          'x-custom-c': true
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: schemas from existing tests
  // ---------------------------------------------------------------------------

  void describe('Round-trip: schemas from existing tests', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'person schema with additionalProperties: false',
        'schema': {
          '$id': 'https://example.io/person',
          'additionalProperties': false,
          'properties': {
            'age': { 'type': 'number' },
            'email': { 'type': 'string' },
            'name': { 'type': 'string' }
          },
          'required': [
            'name',
            'age'
          ],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'address schema',
        'schema': {
          '$id': 'https://example.io/address',
          'properties': {
            'city': { 'type': 'string' },
            'street': { 'type': 'string' }
          },
          'required': ['street'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'config schema with dialect and defaults',
        'schema': {
          '$id': 'https://example.io/config',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': {
            'debug': {
              'default': false,
              'type': 'boolean'
            },
            'name': { 'type': 'string' },
            'timeout': {
              'default': 5000,
              'type': 'number'
            }
          },
          'required': ['name'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'nested schema with $ref and default',
        'schema': {
          '$defs': {
            'Inner': {
              'properties': {
                'value': {
                  'default': 42,
                  'type': 'number'
                }
              },
              'type': 'object'
            }
          },
          '$id': 'https://example.io/nested',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'properties': { 'inner': { '$ref': '#/$defs/Inner' } },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'strict schema with additionalProperties: false',
        'schema': {
          '$id': 'https://example.io/strict',
          '$schema': 'https://json-schema.org/draft/2020-12/schema',
          'additionalProperties': false,
          'properties': {
            'name': { 'type': 'string' },
            'value': { 'type': 'number' }
          },
          'required': ['name'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'User schema with metadata and defaults',
        'schema': {
          '$id': 'https://myapp.io/User',
          'description': 'An application user',
          'properties': {
            'active': {
              'default': true,
              'type': 'boolean'
            },
            'age': { 'type': 'number' },
            'email': { 'type': 'string' },
            'name': {
              'default': 'Anonymous',
              'type': 'string'
            }
          },
          'required': [
            'name',
            'email'
          ],
          'title': 'User',
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'Directory with $anchor and array $ref',
        'schema': {
          '$defs': {
            'Employee': {
              '$anchor': 'employee',
              'properties': { 'id': { 'type': 'string' } },
              'required': ['id'],
              'title': 'Employee',
              'type': 'object'
            }
          },
          '$id': 'https://myapp.io/Directory',
          'properties': {
            'employees': {
              'items': { '$ref': '#/$defs/Employee' },
              'type': 'array'
            },
            'primaryEmployee': { '$ref': '#/$defs/Employee' }
          },
          'required': ['primaryEmployee'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'DateTime with format',
        'schema': {
          '$id': 'https://myapp.io/DateTime',
          'format': 'date-time',
          'type': 'string'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'Person with domain/range and ontology extensions',
        'schema': {
          '$defs': {
            'Address': {
              'properties': {
                'city': { 'type': 'string' },
                'street': { 'type': 'string' }
              },
              'required': [
                'street',
                'city'
              ],
              'type': 'object'
            }
          },
          '$id': 'https://example.io/Person',
          'properties': {
            'address': {
              '$ref': '#/$defs/Address',
              'rdfs:range': 'https://example.io/Address'
            },
            'friends': {
              'items': { 'type': 'object' },
              'rdfs:range': 'https://example.io/Person',
              'type': 'array'
            },
            'name': { 'type': 'string' },
            'tag': {
              'rdfs:domain': 'https://example.io/Taggable',
              'type': 'string'
            }
          },
          'required': ['name'],
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'GraphNode with transitive and symmetric properties',
        'schema': {
          '$id': 'https://example.io/GraphNode',
          'properties': {
            'ancestor': {
              'transitive': true,
              'type': 'string'
            },
            'sibling': {
              'symmetric': true,
              'type': 'string'
            }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'escaped JSON pointer in $ref',
        'schema': {
          '$defs': {
            'address': {
              'properties': { 'street/name': { 'type': 'string' } },
              'type': 'object'
            }
          },
          '$id': 'https://rt.test/EscapedPointer',
          'properties': { 'address': { '$ref': '#/$defs/address' } },
          'type': 'object'
        }
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }
  });

  // ---------------------------------------------------------------------------
  // Tests: complex combined schemas
  // ---------------------------------------------------------------------------

  void describe('Round-trip: complex combined schemas', () => {
    const scenarios: RoundTripScenario[] = [
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'all constraints combined on object',
        'schema': {
          '$id': 'https://rt.test/AllConstraints',
          'additionalProperties': { 'type': 'string' },
          'description': 'Represents a person',
          'maxProperties': 10,
          'minProperties': 1,
          'not': { 'type': 'array' },
          'properties': {
            'age': {
              'exclusiveMaximum': 200,
              'exclusiveMinimum': -1,
              'maximum': 150,
              'minimum': 0,
              'multipleOf': 1,
              'type': 'number'
            },
            'bio': {
              'contentEncoding': 'base64',
              'contentMediaType': 'text/plain',
              'type': 'string'
            },
            'name': {
              'default': 'Anonymous',
              'format': 'custom-name',
              'maxLength': 100,
              'minLength': 1,
              'pattern': '^[A-Z]',
              'readOnly': true,
              'type': 'string'
            },
            'status': {
              'const': 'active',
              'deprecated': true,
              'enum': [
                'active',
                'inactive'
              ],
              'type': 'string',
              'writeOnly': true
            },
            'tags': {
              'maxItems': 10,
              'minItems': 1,
              'type': 'array',
              'uniqueItems': true
            }
          },
          'title': 'A Person',
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'complex composition with allOf, anyOf, if/then, $ref',
        'schema': setThenKeyword({
          '$defs': {
            'Address': {
              'properties': { 'street': { 'type': 'string' } },
              'required': ['street'],
              'type': 'object'
            }
          },
          '$id': 'https://rt.test/ComplexComposition',
          'allOf': [{
            'properties': { 'base': { 'type': 'string' } },
            'type': 'object'
          }],
          'anyOf': [
            {
              'properties': { 'optA': { 'type': 'string' } },
              'type': 'object'
            },
            {
              'properties': { 'optB': { 'type': 'number' } },
              'type': 'object'
            }
          ],
          'if': { 'properties': { 'kind': { 'const': 'special' } } },
          'properties': {
            'address': { '$ref': '#/$defs/Address' },
            'base': { 'type': 'string' },
            'kind': { 'type': 'string' }
          },
          'type': 'object'
        }, { 'required': ['base'] })
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'dependentRequired + dependentSchemas + patternProperties',
        'schema': {
          '$id': 'https://rt.test/DepsCombined',
          'dependentRequired': {
            'email': [
              'name',
              'phone'
            ]
          },
          'dependentSchemas': {
            'billing': {
              'properties': { 'address': { 'type': 'string' } },
              'required': ['address']
            }
          },
          'patternProperties': { '^x-': { 'type': 'string' } },
          'properties': {
            'billing': { 'type': 'string' },
            'email': { 'type': 'string' },
            'name': { 'type': 'string' },
            'phone': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      {
        'check': (schema) => {
          assertRoundTrip(schema);
        },
        'name': 'unevaluatedProperties with conditional',
        'schema': setThenKeyword({
          '$id': 'https://rt.test/UnevalConditional',
          'else': { 'properties': { 'bValue': { 'type': 'string' } } },
          'if': { 'properties': { 'kind': { 'const': 'a' } } },
          'properties': { 'kind': { 'type': 'string' } },
          'required': ['kind'],
          'type': 'object',
          'unevaluatedProperties': false
        }, { 'properties': { 'aValue': { 'type': 'number' } } })
      }
    ];

    for (const {
      check, name, schema
    } of scenarios) {
      void it(name, () => {
        check(schema);
      });
    }

    void it('triple round-trip idempotency', () => {
      const idempotentSchema: Record<string, unknown> = {
        '$defs': {
          'Foo': {
            '$anchor': 'FooAnchor',
            'properties': {
              'label': {
                '$comment': 'a label',
                'type': 'string'
              }
            },
            'required': ['label'],
            'type': 'object'
          }
        },
        '$id': 'https://rt.test/Idempotent',
        'description': 'Verify idempotency',
        'properties': {
          'nested': {
            'properties': {
              'deep': {
                'minimum': 0,
                'type': 'integer'
              }
            },
            'type': 'object',
            'x-custom': 'test'
          },
          'ref': { '$ref': '#/$defs/Foo' }
        },
        'required': ['ref'],
        'title': 'Idempotent Test',
        'type': 'object'
      };
      const rt1 = roundtrip(idempotentSchema);
      const rt2 = roundtrip(rt1);
      const rt3 = roundtrip(rt2);

      assert.deepEqual(rt1, idempotentSchema);
      assert.deepEqual(rt2, rt1);
      assert.deepEqual(rt3, rt2);
    });
  });
}

// ===========================================================================
// Source: serializationEdgeCases.test.ts
// ===========================================================================
{
  type JsonLdNode = Record<string, unknown>;

  function owlNodes(registry: SchemaRegistryInterface): JsonLdNode[] {
    const serializer = new GraphOntologySerializer();

    return serializer.serialize(registry.listGraphs()) as JsonLdNode[];
  }

  function shaclNodes(registry: SchemaRegistryInterface): JsonLdNode[] {
    const serializer = new GraphShaclSerializer();

    return serializer.serialize(registry.listGraphs()) as JsonLdNode[];
  }

  // -------------------------------------------------------------------------
  // OWL: scalar property scenarios
  // -------------------------------------------------------------------------

  interface OwlScalarScenario {
    'expectedRange': string;
    'expectedType': string;
    'name': string;
    'propId': string;
  }

  const owlScalarScenarios: OwlScalarScenario[] = [
    {
      'expectedRange': 'http://www.w3.org/2001/XMLSchema#string',
      'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
      'name': 'emits DatatypeProperty with xsd:string range for name',
      'propId': 'https://example.com/ScalarOnly#name'
    },
    {
      'expectedRange': 'http://www.w3.org/2001/XMLSchema#integer',
      'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
      'name': 'emits DatatypeProperty with xsd:integer range for age',
      'propId': 'https://example.com/ScalarOnly#age'
    },
    {
      'expectedRange': 'http://www.w3.org/2001/XMLSchema#decimal',
      'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
      'name': 'emits DatatypeProperty with xsd:decimal range for score',
      'propId': 'https://example.com/ScalarOnly#score'
    },
    {
      'expectedRange': 'http://www.w3.org/2001/XMLSchema#boolean',
      'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
      'name': 'emits DatatypeProperty with xsd:boolean range for active',
      'propId': 'https://example.com/ScalarOnly#active'
    }
  ];

  void describe('OWL serialization: scalar property ranges', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/ScalarOnly',
      'properties': {
        'active': { 'type': 'boolean' },
        'age': { 'type': 'integer' },
        'name': { 'type': 'string' },
        'score': { 'type': 'number' }
      },
      'type': 'object'
    });

    const nodes = owlNodes(reg);

    for (const scenario of owlScalarScenarios) {
      void it(scenario.name, () => {
        const prop = nodes.find((node) => {
          return node['@id'] === scenario.propId;
        });

        assert.ok(prop !== undefined, scenario.name);
        assert.strictEqual(prop['@type'], scenario.expectedType, `${scenario.name} — type`);
        assert.deepStrictEqual(
          prop['http://www.w3.org/2000/01/rdf-schema#range'],
          { '@id': scenario.expectedRange },
          `${scenario.name} — range`
        );
      });
    }
  });

  // -------------------------------------------------------------------------
  // OWL: mixed ref/scalar — property type check
  // -------------------------------------------------------------------------

  interface OwlMixedPropScenario {
    'expectedType': string;
    'name': string;
    'propId': string;
  }

  const owlMixedPropScenarios: OwlMixedPropScenario[] = [
    {
      'expectedType': 'http://www.w3.org/2002/07/owl#DatatypeProperty',
      'name': 'emits DatatypeProperty for scalar label in mixed schema',
      'propId': 'https://example.com/MixedProps#label'
    },
    {
      'expectedType': 'http://www.w3.org/2002/07/owl#ObjectProperty',
      'name': 'emits ObjectProperty for $ref in mixed schema',
      'propId': 'https://example.com/MixedProps#ref'
    }
  ];

  void describe('OWL serialization: mixed ref/scalar property types', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/Target',
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    });
    reg.set({
      '$id': 'https://example.com/MixedProps',
      'properties': {
        'label': { 'type': 'string' },
        'ref': { '$ref': 'https://example.com/Target' }
      },
      'type': 'object'
    });

    const nodes = owlNodes(reg);

    for (const {
      expectedType, name, propId
    } of owlMixedPropScenarios) {
      void it(name, () => {
        const prop = nodes.find((node) => {
          return node['@id'] === propId;
        });

        assert.ok(prop !== undefined, `${name} — exists`);
        assert.strictEqual(prop['@type'], expectedType, `${name} — type`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // OWL: array of $ref with allValuesFrom restriction
  // -------------------------------------------------------------------------

  void describe('OWL serialization: array of $ref with allValuesFrom', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/Item',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });
    reg.set({
      '$id': 'https://example.com/Container',
      'properties': {
        'items': {
          'items': { '$ref': 'https://example.com/Item' },
          'type': 'array'
        }
      },
      'type': 'object'
    });

    const nodes = owlNodes(reg);

    interface ArrayRefScenario {
      'check': 'allValuesFrom' | 'classExists' | 'propRange' | 'propType';
      'name': string;
    }

    const scenarios: ArrayRefScenario[] = [
      {
        'check': 'propType',
        'name': 'items property is ObjectProperty'
      },
      {
        'check': 'propRange',
        'name': 'items property range is rdf:List'
      },
      {
        'check': 'classExists',
        'name': 'Container class exists'
      },
      {
        'check': 'allValuesFrom',
        'name': 'allValuesFrom restriction targets Item'
      }
    ];

    for (const {
      check, name
    } of scenarios) {
      void it(name, () => {
        if (check === 'propType') {
          const itemsProp = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Container#items';
          });

          assert.ok(itemsProp !== undefined, 'array of $ref — items exists');
          assert.strictEqual(itemsProp['@type'], 'http://www.w3.org/2002/07/owl#ObjectProperty', 'array of $ref — items type');
        }

        if (check === 'propRange') {
          const itemsProp = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Container#items';
          });

          assert.ok(itemsProp !== undefined, 'array of $ref — items exists');
          assert.deepStrictEqual(
            itemsProp['http://www.w3.org/2000/01/rdf-schema#range'],
            { '@id': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#List' },
            'array of $ref — range'
          );
        }

        if (check === 'classExists') {
          const classNode = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Container'
            && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
          });

          assert.ok(classNode !== undefined, 'array of $ref — Container class exists');
        }

        if (check === 'allValuesFrom') {
          const classNode = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Container'
            && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
          });

          assert.ok(classNode !== undefined, 'array of $ref — Container class exists');

          const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

          assert.ok(Array.isArray(subs), 'array of $ref — rdfs:subClassOf exists');

          const avfRestriction = subs.find((sub) => {
            return sub['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
          });

          assert.ok(avfRestriction !== undefined, 'array of $ref — allValuesFrom exists');
          assert.deepStrictEqual(
            avfRestriction['http://www.w3.org/2002/07/owl#allValuesFrom'],
            { '@id': 'https://example.com/Item' },
            'array of $ref — allValuesFrom target'
          );
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // OWL: readOnly/writeOnly annotations
  // -------------------------------------------------------------------------

  interface OwlAccessScenario {
    'expectedReadOnly': boolean | undefined;
    'expectedWriteOnly': boolean | undefined;
    'name': string;
    'propId': string;
  }

  const owlAccessScenarios: OwlAccessScenario[] = [
    {
      'expectedReadOnly': true,
      'expectedWriteOnly': undefined,
      'name': 'emits dash:readOnly true for readOnly property',
      'propId': 'https://example.com/AccessControl#createdAt'
    },
    {
      'expectedReadOnly': undefined,
      'expectedWriteOnly': true,
      'name': 'emits dash:writeOnly true for writeOnly property',
      'propId': 'https://example.com/AccessControl#password'
    }
  ];

  void describe('OWL serialization: readOnly/writeOnly annotations', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/AccessControl',
      'properties': {
        'createdAt': {
          'readOnly': true,
          'type': 'string'
        },
        'password': {
          'type': 'string',
          'writeOnly': true
        }
      },
      'type': 'object'
    });

    const nodes = owlNodes(reg);

    for (const {
      expectedReadOnly, expectedWriteOnly, name, propId
    } of owlAccessScenarios) {
      void it(name, () => {
        const prop = nodes.find((node) => {
          return node['@id'] === propId;
        });

        assert.ok(prop !== undefined, `${name} — exists`);
        assert.strictEqual(prop['http://datashapes.org/dash#readOnly'], expectedReadOnly, `${name} — readOnly`);
        assert.strictEqual(prop['http://datashapes.org/dash#writeOnly'], expectedWriteOnly, `${name} — writeOnly`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // OWL: enum oneOf
  // -------------------------------------------------------------------------

  void describe('OWL serialization: enum oneOf', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/StatusEnum',
      'enum': [
        'active',
        'inactive',
        'pending'
      ],
      'type': 'string'
    });

    const nodes = owlNodes(reg);

    interface EnumScenario {
      'check': 'hasOneOf' | 'isList' | 'listLength';
      'name': string;
    }

    const scenarios: EnumScenario[] = [
      {
        'check': 'hasOneOf',
        'name': 'class with owl:oneOf exists'
      },
      {
        'check': 'isList',
        'name': 'owl:oneOf is @list'
      },
      {
        'check': 'listLength',
        'name': 'owl:oneOf contains three values'
      }
    ];

    for (const {
      check, name
    } of scenarios) {
      void it(name, () => {
        const enumNode = nodes.find((node) => {
          return node['@id'] === 'https://example.com/StatusEnum'
          && node['http://www.w3.org/2002/07/owl#oneOf'] !== undefined;
        });

        assert.ok(enumNode !== undefined, 'enum — class with owl:oneOf exists');

        if (check === 'isList' || check === 'listLength') {
          const oneOf = enumNode['http://www.w3.org/2002/07/owl#oneOf'] as JsonLdNode;

          assert.ok(oneOf['@list'] !== undefined, 'enum — owl:oneOf is @list');

          if (check === 'listLength') {
            const listItems = oneOf['@list'] as unknown[];

            assert.strictEqual(listItems.length, 3, 'enum — three values');
          }
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // OWL: allOf composition and inheritance
  // -------------------------------------------------------------------------

  interface OwlSubClassScenario {
    'classId': string;
    'expectedSuperClasses': string[];
    'name': string;
    'schemas': Array<Record<string, unknown>>;
  }

  const owlSubClassScenarios: OwlSubClassScenario[] = [
    {
      'classId': 'https://example.com/Composed',
      'expectedSuperClasses': [
        'https://example.com/Base',
        'https://example.com/Extra'
      ],
      'name': 'emits rdfs:subClassOf for allOf composition with multiple $ref entries',
      'schemas': [
        {
          '$id': 'https://example.com/Base',
          'properties': { 'id': { 'type': 'string' } },
          'type': 'object'
        },
        {
          '$id': 'https://example.com/Extra',
          'properties': { 'extra': { 'type': 'number' } },
          'type': 'object'
        },
        {
          '$id': 'https://example.com/Composed',
          'allOf': [
            { '$ref': 'https://example.com/Base' },
            { '$ref': 'https://example.com/Extra' }
          ],
          'type': 'object'
        }
      ]
    },
    {
      'classId': 'https://example.com/Dog',
      'expectedSuperClasses': ['https://example.com/Animal'],
      'name': 'emits rdfs:subClassOf for schema inheriting via allOf $ref',
      'schemas': [
        {
          '$id': 'https://example.com/Animal',
          'properties': { 'species': { 'type': 'string' } },
          'required': ['species'],
          'type': 'object'
        },
        {
          '$id': 'https://example.com/Dog',
          'allOf': [{ '$ref': 'https://example.com/Animal' }],
          'properties': { 'breed': { 'type': 'string' } },
          'type': 'object'
        }
      ]
    }
  ];

  void describe('OWL serialization: allOf composition and inheritance', () => {
    for (const {
      classId, expectedSuperClasses, name, schemas
    } of owlSubClassScenarios) {
      void it(name, () => {
        const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

        for (const schema of schemas) {
          reg.set(schema);
        }

        const nodes = owlNodes(reg);

        const classNode = nodes.find((node) => {
          return node['@id'] === classId
          && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
        });

        assert.ok(classNode !== undefined, `${name} — class exists`);

        const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

        assert.ok(subs !== undefined, `${name} — rdfs:subClassOf exists`);

        const subArray = Array.isArray(subs) ? subs : [subs];

        for (const superClass of expectedSuperClasses) {
          assert.ok(
            subArray.some((sub) => {
              return sub['@id'] === superClass;
            }),
            `${name} — subClassOf ${superClass}`
          );
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // OWL: no-$id schema
  // -------------------------------------------------------------------------

  void describe('OWL serialization: no-$id schema', () => {
    void it('throws SchemaError for schema with no $id', () => {
      const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

      assert.throws(() => {
        reg.set({
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        });
      }, (error: unknown) => {
        return error instanceof Error && error.message.includes('$id');
      }, 'no $id — throws SchemaError');
    });
  });

  // -------------------------------------------------------------------------
  // SHACL: string constraints
  // -------------------------------------------------------------------------

  interface ShaclStringConstraintScenario {
    'expectedMaxLength': number;
    'expectedMinLength': number;
    'name': string;
    'propPathFragment': string;
    'schemaId': string;
  }

  const shaclStringConstraintScenarios: ShaclStringConstraintScenario[] = [{
    'expectedMaxLength': 10,
    'expectedMinLength': 2,
    'name': 'emits sh:minLength and sh:maxLength for string constraints',
    'propPathFragment': 'code',
    'schemaId': 'https://example.com/StringConstrained'
  }];

  void describe('SHACL serialization: string constraints', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/StringConstrained',
      'properties': {
        'code': {
          'maxLength': 10,
          'minLength': 2,
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const shapes = shaclNodes(reg);

    for (const {
      expectedMaxLength, expectedMinLength, name, propPathFragment, schemaId
    } of shaclStringConstraintScenarios) {
      void it(name, () => {
        const nodeShape = shapes.find((shape) => {
          return shape['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(nodeShape !== undefined, `${schemaId} — NodeShape exists`);

        const propShapes = nodeShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

        assert.ok(Array.isArray(propShapes), `${schemaId} — sh:property exists`);

        const prop = propShapes.find((propShape) => {
          const path = propShape['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

          return typeof path?.['@id'] === 'string' && (path['@id']).includes(propPathFragment);
        });

        assert.ok(prop !== undefined, `${name} — ${propPathFragment} prop exists`);
        assert.strictEqual(prop['http://www.w3.org/ns/shacl#minLength'], expectedMinLength, `${name} — minLength`);
        assert.strictEqual(prop['http://www.w3.org/ns/shacl#maxLength'], expectedMaxLength, `${name} — maxLength`);
      });
    }
  });

  // -------------------------------------------------------------------------
  // SHACL: pattern constraint
  // -------------------------------------------------------------------------

  interface ShaclPatternScenario {
    'expectedPattern': string;
    'name': string;
    'propPathFragment': string;
    'schema': Record<string, unknown>;
  }

  const shaclPatternScenarios: ShaclPatternScenario[] = [{
    'expectedPattern': '^\\d{5}$',
    'name': 'emits sh:pattern for pattern constraint',
    'propPathFragment': 'zipCode',
    'schema': {
      '$id': 'https://example.com/PatternConstrained',
      'properties': {
        'zipCode': {
          'pattern': '^\\d{5}$',
          'type': 'string'
        }
      },
      'type': 'object'
    }
  }];

  void describe('SHACL serialization: pattern constraints', () => {
    for (const {
      expectedPattern, name, propPathFragment, schema
    } of shaclPatternScenarios) {
      void it(name, () => {
        const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

        reg.set(schema);

        const shapes = shaclNodes(reg);

        const nodeShape = shapes.find((shape) => {
          return shape['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
        });

        assert.ok(nodeShape !== undefined, 'pattern — NodeShape exists');

        const propShapes = nodeShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

        assert.ok(Array.isArray(propShapes), 'pattern — sh:property exists');

        const prop = propShapes.find((propShape) => {
          const path = propShape['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

          return typeof path?.['@id'] === 'string' && (path['@id']).includes(propPathFragment);
        });

        assert.ok(prop !== undefined, `pattern — ${propPathFragment} prop exists`);
        assert.strictEqual(prop['http://www.w3.org/ns/shacl#pattern'], expectedPattern, 'pattern — value');
      });
    }
  });

  // -------------------------------------------------------------------------
  // SHACL: array cardinality
  // -------------------------------------------------------------------------

  void describe('SHACL serialization: array cardinality', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/ArrayConstrained',
      'items': { 'type': 'string' },
      'maxItems': 10,
      'minItems': 1,
      'type': 'array'
    });

    const shapes = shaclNodes(reg);

    interface CardinalityScenario {
      'check': 'max' | 'min';
      'name': string;
    }

    const scenarios: CardinalityScenario[] = [
      {
        'check': 'min',
        'name': 'emits minItems constraint for array'
      },
      {
        'check': 'max',
        'name': 'emits maxItems constraint for array'
      }
    ];

    for (const {
      check, name
    } of scenarios) {
      void it(name, () => {
        const nodeShape = shapes.find((shape) => {
          return shape['@id'] === 'https://example.com/ArrayConstrained';
        });

        assert.ok(nodeShape !== undefined, 'array cardinality — NodeShape exists');

        if (check === 'min') {
          const hasMinCount = nodeShape['http://www.w3.org/ns/shacl#minCount'] !== undefined;
          const hasJtMin = nodeShape['https://json-tology.dev/vocab#minItems'] !== undefined;

          assert.ok(hasMinCount || hasJtMin, 'array cardinality — minItems emitted');
        }

        if (check === 'max') {
          const hasMaxCount = nodeShape['http://www.w3.org/ns/shacl#maxCount'] !== undefined;
          const hasJtMax = nodeShape['https://json-tology.dev/vocab#maxItems'] !== undefined;

          assert.ok(hasMaxCount || hasJtMax, 'array cardinality — maxItems emitted');
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // SHACL: nested $ref property
  // -------------------------------------------------------------------------

  void describe('SHACL serialization: nested $ref property', () => {
    const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

    reg.set({
      '$id': 'https://example.com/Address',
      'properties': {
        'city': { 'type': 'string' },
        'street': { 'type': 'string' }
      },
      'type': 'object'
    });
    reg.set({
      '$id': 'https://example.com/Person',
      'properties': {
        'address': { '$ref': 'https://example.com/Address' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    });

    const shapes = shaclNodes(reg);

    interface NestedRefScenario {
      'check': 'classTarget' | 'nodeOrClassPresent' | 'nodeTarget' | 'propExists' | 'shapeExists';
      'name': string;
    }

    const scenarios: NestedRefScenario[] = [
      {
        'check': 'shapeExists',
        'name': 'Person shape exists'
      },
      {
        'check': 'propExists',
        'name': 'address property shape exists'
      },
      {
        'check': 'nodeOrClassPresent',
        'name': 'sh:node or sh:class present for address'
      }
    ];

    for (const {
      check, name
    } of scenarios) {
      void it(name, () => {
        const personShape = shapes.find((shape) => {
          return shape['@id'] === 'https://example.com/Person';
        });

        assert.ok(personShape !== undefined, 'nested $ref — Person shape exists');

        if (check === 'shapeExists') {
          return;
        }

        const propShapes = personShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

        assert.ok(Array.isArray(propShapes), 'nested $ref — sh:property exists');

        const addressProp = propShapes.find((prop) => {
          const path = prop['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

          return typeof path?.['@id'] === 'string' && (path['@id']).includes('address');
        });

        assert.ok(addressProp !== undefined, 'nested $ref — address prop exists');

        if (check === 'propExists') {
          return;
        }

        const hasNode = addressProp['http://www.w3.org/ns/shacl#node'] !== undefined;
        const hasClass = addressProp['http://www.w3.org/ns/shacl#class'] !== undefined;

        assert.ok(hasNode || hasClass, 'nested $ref — sh:node or sh:class present');

        if (hasNode) {
          assert.deepStrictEqual(
            addressProp['http://www.w3.org/ns/shacl#node'],
            { '@id': 'https://example.com/Address' },
            'nested $ref — sh:node target'
          );
        }

        if (hasClass) {
          assert.deepStrictEqual(
            addressProp['http://www.w3.org/ns/shacl#class'],
            { '@id': 'https://example.com/Address' },
            'nested $ref — sh:class target'
          );
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // SHACL: required vs optional minCount
  // -------------------------------------------------------------------------

  interface ShaclRequiredScenario {
    'expectedMinCount': 0 | 1 | undefined;
    'name': string;
    'propPathFragment': string;
    'schemas': Array<Record<string, unknown>>;
    'shapeId': string;
  }

  const shaclRequiredScenarios: ShaclRequiredScenario[] = [
    {
      'expectedMinCount': 1,
      'name': 'emits sh:minCount 1 for required username',
      'propPathFragment': 'username',
      'schemas': [{
        '$id': 'https://example.com/RequiredOptional',
        'properties': {
          'nickname': { 'type': 'string' },
          'username': { 'type': 'string' }
        },
        'required': ['username'],
        'type': 'object'
      }],
      'shapeId': 'https://example.com/RequiredOptional'
    },
    {
      'expectedMinCount': undefined,
      'name': 'emits absent or 0 sh:minCount for optional nickname',
      'propPathFragment': 'nickname',
      'schemas': [{
        '$id': 'https://example.com/RequiredOptional',
        'properties': {
          'nickname': { 'type': 'string' },
          'username': { 'type': 'string' }
        },
        'required': ['username'],
        'type': 'object'
      }],
      'shapeId': 'https://example.com/RequiredOptional'
    },
    {
      'expectedMinCount': 1,
      'name': 'emits sh:minCount 1 for required name in multi-required schema',
      'propPathFragment': 'name',
      'schemas': [{
        '$id': 'https://example.com/MultiRequired',
        'properties': {
          'email': { 'type': 'string' },
          'name': { 'type': 'string' },
          'optional': { 'type': 'string' }
        },
        'required': [
          'email',
          'name'
        ],
        'type': 'object'
      }],
      'shapeId': 'https://example.com/MultiRequired'
    },
    {
      'expectedMinCount': 1,
      'name': 'emits sh:minCount 1 for required email in multi-required schema',
      'propPathFragment': 'email',
      'schemas': [{
        '$id': 'https://example.com/MultiRequired',
        'properties': {
          'email': { 'type': 'string' },
          'name': { 'type': 'string' },
          'optional': { 'type': 'string' }
        },
        'required': [
          'email',
          'name'
        ],
        'type': 'object'
      }],
      'shapeId': 'https://example.com/MultiRequired'
    },
    {
      'expectedMinCount': undefined,
      'name': 'emits absent or 0 sh:minCount for optional prop in multi-required schema',
      'propPathFragment': 'optional',
      'schemas': [{
        '$id': 'https://example.com/MultiRequired',
        'properties': {
          'email': { 'type': 'string' },
          'name': { 'type': 'string' },
          'optional': { 'type': 'string' }
        },
        'required': [
          'email',
          'name'
        ],
        'type': 'object'
      }],
      'shapeId': 'https://example.com/MultiRequired'
    }
  ];

  void describe('SHACL serialization: required vs optional minCount', () => {
    for (const {
      expectedMinCount, name, propPathFragment, schemas, shapeId
    } of shaclRequiredScenarios) {
      void it(name, () => {
        const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

        for (const schema of schemas) {
          reg.set(schema);
        }

        const shapes = shaclNodes(reg);

        const nodeShape = shapes.find((shape) => {
          return shape['@id'] === shapeId;
        });

        assert.ok(nodeShape !== undefined, `${name} — NodeShape exists`);

        const propShapes = nodeShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];

        assert.ok(Array.isArray(propShapes), `${name} — sh:property exists`);

        const prop = propShapes.find((propShape) => {
          const path = propShape['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;

          return typeof path?.['@id'] === 'string' && (path['@id']).includes(propPathFragment);
        });

        assert.ok(prop !== undefined, `${name} — ${propPathFragment} prop exists`);

        if (expectedMinCount === undefined) {
          const minCount = prop['http://www.w3.org/ns/shacl#minCount'];

          assert.ok(
            minCount === undefined || minCount === 0,
            `${name} — minCount absent or 0`
          );
        } else {
          assert.strictEqual(prop['http://www.w3.org/ns/shacl#minCount'], expectedMinCount, `${name} — minCount ${expectedMinCount}`);
        }
      });
    }
  });

  // -------------------------------------------------------------------------
  // Cross-cutting edge cases
  // -------------------------------------------------------------------------

  void describe('cross-cutting serialization edge cases', () => {
    void it('edge: schema with only $defs and no properties produces class but no property nodes', () => {
      const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

      reg.set({
        '$defs': {
          'Inner': {
            'properties': { 'x': { 'type': 'string' } },
            'type': 'object'
          }
        },
        '$id': 'https://example.com/DefsOnly',
        'type': 'object'
      });

      const owlOutput = owlNodes(reg);

      const classNode = owlOutput.find((node) => {
        return node['@id'] === 'https://example.com/DefsOnly'
        && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
      });

      assert.ok(classNode !== undefined, 'edge: $defs only — OWL class exists');

      const propNodes = owlOutput.filter((node) => {
        const domain = node['http://www.w3.org/2000/01/rdf-schema#domain'] as JsonLdNode | undefined;

        return domain?.['@id'] === 'https://example.com/DefsOnly';
      });

      assert.strictEqual(propNodes.length, 0, 'edge: $defs only — no direct property nodes');
    });

    void it('edge: readOnly and writeOnly on same property emits both annotations', () => {
      const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

      reg.set({
        '$id': 'https://example.com/BothAccess',
        'properties': {
          'token': {
            'readOnly': true,
            'type': 'string',
            'writeOnly': true
          }
        },
        'type': 'object'
      });

      const nodes = owlNodes(reg);

      const tokenProp = nodes.find((node) => {
        return node['@id'] === 'https://example.com/BothAccess#token';
      });

      assert.ok(tokenProp !== undefined, 'edge: both access — token prop exists');
      assert.strictEqual(tokenProp['http://datashapes.org/dash#readOnly'], true, 'edge: both access — readOnly');
      assert.strictEqual(tokenProp['http://datashapes.org/dash#writeOnly'], true, 'edge: both access — writeOnly');
    });

    void it('edge: schema with all constraint types combined serializes without error', () => {
      const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

      reg.set({
        '$id': 'https://example.com/AllConstraints',
        'additionalProperties': false,
        'enum': [
          'a',
          'b'
        ],
        'properties': {
          'count': {
            'exclusiveMaximum': 100,
            'exclusiveMinimum': 0,
            'multipleOf': 5,
            'type': 'integer'
          },
          'name': {
            'maxLength': 50,
            'minLength': 1,
            'pattern': '^[A-Z]',
            'type': 'string'
          }
        },
        'required': ['name'],
        'type': 'object'
      });

      const owlOutput = owlNodes(reg);
      const shaclOutput = shaclNodes(reg);

      assert.ok(owlOutput.length > 0, 'edge: all constraints — OWL output non-empty');
      assert.ok(shaclOutput.length > 0, 'edge: all constraints — SHACL output non-empty');

      const owlClass = owlOutput.find((node) => {
        return node['@id'] === 'https://example.com/AllConstraints'
        && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
      });

      assert.ok(owlClass !== undefined, 'edge: all constraints — OWL class exists');

      const shaclShape = shaclOutput.find((shape) => {
        return shape['@id'] === 'https://example.com/AllConstraints';
      });

      assert.ok(shaclShape !== undefined, 'edge: all constraints — SHACL shape exists');
    });

    void it('produces valid class/shape with no property shapes for empty schema', () => {
      const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

      reg.set({
        '$id': 'https://example.com/Empty',
        'type': 'object'
      });

      const owlOutput = owlNodes(reg);

      const owlClass = owlOutput.find((node) => {
        return node['@id'] === 'https://example.com/Empty'
        && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
      });

      assert.ok(owlClass !== undefined, 'empty schema — OWL class exists');

      const propNodes = owlOutput.filter((node) => {
        const type = node['@type'];

        return type === 'http://www.w3.org/2002/07/owl#DatatypeProperty'
        || type === 'http://www.w3.org/2002/07/owl#ObjectProperty';
      });

      const propsForEmpty = propNodes.filter((node) => {
        const domain = node['http://www.w3.org/2000/01/rdf-schema#domain'] as JsonLdNode | undefined;

        return domain?.['@id'] === 'https://example.com/Empty';
      });

      assert.strictEqual(propsForEmpty.length, 0, 'empty schema — no OWL property nodes');

      const shaclOutput = shaclNodes(reg);

      const shaclShape = shaclOutput.find((shape) => {
        return shape['@id'] === 'https://example.com/Empty';
      });

      assert.ok(shaclShape !== undefined, 'empty schema — SHACL shape exists');
      assert.strictEqual(shaclShape['@type'], 'http://www.w3.org/ns/shacl#NodeShape', 'empty schema — SHACL type');

      const shProperties = shaclShape['http://www.w3.org/ns/shacl#property'];

      assert.ok(
        shProperties === undefined || (Array.isArray(shProperties) && shProperties.length === 0),
        'empty schema — no SHACL property shapes'
      );
    });

    void it('uses full IRIs in all predicate keys, no CURIE shortcuts', () => {
      const reg = JsonTology.create({ 'baseIRI': 'https://test.io' }).registry;

      reg.set({
        '$id': 'https://example.com/FullIri',
        'properties': {
          'name': { 'type': 'string' },
          'ref': { '$ref': 'https://example.com/FullIri' }
        },
        'required': ['name'],
        'type': 'object'
      });

      const owlOutput = owlNodes(reg);
      const shaclOutput = shaclNodes(reg);

      const curiePattern = /^[a-z]+:[A-Za-z]/u;
      const allowedPrefixes = new Set([
        '@context',
        '@graph',
        '@id',
        '@list',
        '@type',
        '@value'
      ]);

      function assertNoShortCuries(nodes: JsonLdNode[], vocabulary: string): void {
        for (const node of nodes) {
          for (const key of Object.keys(node)) {
            if (allowedPrefixes.has(key)) {
              continue;
            }

            assert.ok(
              !curiePattern.test(key) || key.startsWith('http://') || key.startsWith('https://') || key.startsWith('urn:'),
              `${vocabulary} output must use full IRIs, found CURIE key: ${key}`
            );
          }
        }
      }

      assertNoShortCuries(owlOutput, 'OWL');
      assertNoShortCuries(shaclOutput, 'SHACL');
    });
  });
}

// ===========================================================================
// Source: shaclSerializer.test.ts
// ===========================================================================
{
  function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
    Reflect.set(target, key, value);

    return target;
  }

  const thenKeyword: string = String.fromCodePoint(116, 104, 101, 110);

  function setThenKeyword(target: Record<string, unknown>, value: unknown): Record<string, unknown> {
    setSchemaKey(target, thenKeyword, value);

    return target;
  }

  const serializer = new GraphShaclSerializer();

  function serialize(schema: Record<string, unknown>): unknown[] {
    const graph = new SchemaGraph(schema);

    return serializer.serialize([graph]);
  }

  function findShape(shapes: unknown[], targetId: string): Record<string, unknown> | undefined {
    return (shapes as Array<Record<string, unknown>>).find((shape) => {
      return shape['@id'] === targetId;
    });
  }

  function findProp(shape: Record<string, unknown>, pathId: string): Record<string, unknown> | undefined {
    const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

    return props.find((prop) => {
      return (prop['http://www.w3.org/ns/shacl#path'] as Record<string, unknown>)['@id'] === pathId;
    });
  }

  void describe('GraphShaclSerializer', () => {
    void it('top-level shape attributes', () => {
      const scenarios = [
        {
          'expected': { '@type': 'http://www.w3.org/ns/shacl#NodeShape' },
          'label': 'NodeShape for object schema',
          'schema': {
            '$id': 'https://example.com/Thing',
            'properties': { 'name': { 'type': 'string' } },
            'type': 'object'
          } as const
        },
        {
          'expected': { 'http://www.w3.org/ns/shacl#closed': true },
          'label': 'http://www.w3.org/ns/shacl#closed for additionalProperties: false',
          'schema': {
            '$id': 'https://example.com/Strict',
            'additionalProperties': false,
            'properties': { 'a': { 'type': 'string' } },
            'type': 'object'
          } as const
        },
        {
          'expected': { 'http://www.w3.org/ns/shacl#deactivated': true },
          'label': 'http://www.w3.org/ns/shacl#deactivated for deprecated schema',
          'schema': {
            '$id': 'https://example.com/Old',
            'deprecated': true,
            'properties': { 'name': { 'type': 'string' } },
            'type': 'object'
          } as const
        },
        {
          'expected': {
            'http://www.w3.org/ns/shacl#maxCount': 4,
            'http://www.w3.org/ns/shacl#minCount': 1
          },
          'label': 'http://www.w3.org/ns/shacl#minCount and sh:maxCount for array node cardinality',
          'schema': {
            '$id': 'https://example.com/TagList',
            'maxItems': 4,
            'minItems': 1,
            'type': 'array',
            'uniqueItems': true
          } as const
        }
      ] as const;

      for (const {
        expected, label, schema
      } of scenarios) {
        const shapes = serialize(schema);
        const shape = findShape(shapes, schema.$id);

        assert.ok(shape, label);

        for (const [
          key,
          value
        ] of Object.entries(expected)) {
          assert.deepEqual(shape[key], value, `${label}: ${key}`);
        }
      }
    });

    void it('single-property constraints', () => {
      const scenarios = [
        {
          'expected': {
            '@type': 'http://www.w3.org/ns/shacl#PropertyShape',
            'http://www.w3.org/ns/shacl#datatype': { '@id': 'http://www.w3.org/2001/XMLSchema#integer' },
            'http://www.w3.org/ns/shacl#maxCount': 1,
            'http://www.w3.org/ns/shacl#maxInclusive': 150,
            'http://www.w3.org/ns/shacl#minInclusive': 0
          },
          'label': 'integer min/max inclusive',
          'propKey': 'age',
          'schema': {
            '$id': 'https://example.com/T1',
            'properties': {
              'age': {
                'maximum': 150,
                'minimum': 0,
                'type': 'integer'
              }
            },
            'type': 'object'
          } as const
        },
        {
          'expected': {
            'http://www.w3.org/ns/shacl#maxLength': 10,
            'http://www.w3.org/ns/shacl#minLength': 2,
            'http://www.w3.org/ns/shacl#pattern': '^[A-Z]+$'
          },
          'label': 'string pattern/minLength/maxLength',
          'propKey': 'code',
          'schema': {
            '$id': 'https://example.com/T2',
            'properties': {
              'code': {
                'maxLength': 10,
                'minLength': 2,
                'pattern': '^[A-Z]+$',
                'type': 'string'
              }
            },
            'type': 'object'
          } as const
        },
        {
          'expected': {
            'http://www.w3.org/ns/shacl#maxExclusive': 100,
            'http://www.w3.org/ns/shacl#minExclusive': 0
          },
          'label': 'exclusive numeric constraints',
          'propKey': 'score',
          'schema': {
            '$id': 'https://example.com/T3',
            'properties': {
              'score': {
                'exclusiveMaximum': 100,
                'exclusiveMinimum': 0,
                'type': 'number'
              }
            },
            'type': 'object'
          } as const
        },
        {
          'expected': { 'https://json-tology.dev/vocab#multipleOf': 0.25 },
          'label': 'jt:multipleOf for numeric property',
          'propKey': 'step',
          'schema': {
            '$id': 'https://example.com/T4',
            'properties': {
              'step': {
                'multipleOf': 0.25,
                'type': 'number'
              }
            },
            'type': 'object'
          } as const
        },
        {
          'expected': { 'http://purl.org/dc/terms/format': 'application/json' },
          'label': 'dct:format for contentMediaType',
          'propKey': 'data',
          'schema': {
            '$id': 'https://example.com/T5',
            'properties': {
              'data': {
                'contentEncoding': 'base64',
                'contentMediaType': 'application/json',
                'type': 'string'
              }
            },
            'type': 'object'
          } as const
        },
        {
          'expected': { 'http://www.w3.org/ns/shacl#description': 'The name' },
          'label': 'property description',
          'propKey': 'name',
          'schema': {
            '$id': 'https://example.com/T6',
            'properties': {
              'name': {
                'description': 'The name',
                'type': 'string'
              }
            },
            'type': 'object'
          } as const
        }
      ] as const;

      for (const {
        expected, label, schema
      } of scenarios) {
        const shapes = serialize(schema);
        const shape = findShape(shapes, schema.$id) as Record<string, unknown>;
        const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

        assert.equal(props.length, 1, `${label}: one property`);

        for (const [
          key,
          value
        ] of Object.entries(expected)) {
          assert.deepEqual(props[0][key], value, `${label}: ${key}`);
        }
      }
    });

    void it('composition keywords (allOf, anyOf, not, enum)', () => {
      const scenarios = [
        {
          'expectedKey': 'http://www.w3.org/ns/shacl#and',
          'expectedValue': {
            '@list': [
              { '@id': 'https://example.com/A' },
              { '@id': 'https://example.com/B' }
            ]
          },
          'label': 'http://www.w3.org/ns/shacl#and from allOf',
          'schema': {
            '$id': 'https://example.com/Combined',
            'allOf': [
              { '$ref': 'https://example.com/A' },
              { '$ref': 'https://example.com/B' }
            ],
            'type': 'object'
          } as const
        },
        {
          'expectedKey': 'http://www.w3.org/ns/shacl#or',
          'expectedValue': {
            '@list': [
              { '@id': 'https://example.com/X' },
              { '@id': 'https://example.com/Y' }
            ]
          },
          'label': 'http://www.w3.org/ns/shacl#or from anyOf',
          'schema': {
            '$id': 'https://example.com/Union',
            'anyOf': [
              { '$ref': 'https://example.com/X' },
              { '$ref': 'https://example.com/Y' }
            ],
            'type': 'object'
          } as const
        },
        {
          'expectedKey': 'http://www.w3.org/ns/shacl#not',
          'expectedValue': { '@id': 'https://example.com/A' },
          'label': 'http://www.w3.org/ns/shacl#not',
          'schema': {
            '$id': 'https://example.com/NotA',
            'not': { '$ref': 'https://example.com/A' },
            'type': 'object'
          } as const
        },
        {
          'expectedKey': 'http://www.w3.org/ns/shacl#in',
          'expectedValue': {
            '@list': [
              'active',
              'inactive'
            ]
          },
          'label': 'http://www.w3.org/ns/shacl#in from enum',
          'schema': {
            '$id': 'https://example.com/Status',
            'enum': [
              'active',
              'inactive'
            ],
            'properties': {},
            'type': 'object'
          } as const
        }
      ] as const;

      for (const {
        expectedKey, expectedValue, label, schema
      } of scenarios) {
        const shapes = serialize(schema);
        const shape = findShape(shapes, schema.$id) as Record<string, unknown>;
        const actual = shape[expectedKey];

        assert.ok(actual !== undefined && actual !== null, `${label}: ${expectedKey} present`);
        assert.deepEqual(actual, expectedValue, `${label}: ${expectedKey} value`);
      }
    });

    void it('edge-case property and schema handling', () => {
      const edgeScenarios = [
        {
          'assertions': (shapes: unknown[]) => {
            const shape = findShape(shapes, 'https://example.com/NoRequired');

            if (shape === undefined) {
              assert.fail('edge: no required — shape exists');
            }
            const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

            assert.ok(Array.isArray(props), 'edge: no required — properties exist');
            for (const prop of props) {
              assert.equal(prop['http://www.w3.org/ns/shacl#minCount'], undefined, 'edge: no required — no minCount');
            }
          },
          'name': 'edge: schema with no required properties emits no sh:minCount',
          'schema': {
            '$id': 'https://example.com/NoRequired',
            'properties': {
              'a': { 'type': 'string' },
              'b': { 'type': 'number' }
            },
            'type': 'object'
          } as const
        },
        {
          'assertions': (shapes: unknown[]) => {
            const shape = findShape(shapes, 'https://example.com/MultiType');

            if (shape === undefined) {
              assert.fail('edge: multiple types — shape exists');
            }
            const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

            assert.ok(Array.isArray(props) && props.length > 0, 'edge: multiple types — has properties');
          },
          'name': 'edge: property with multiple types produces a property shape',
          'schema': {
            '$id': 'https://example.com/MultiType',
            'properties': {
              'value': {
                'type': [
                  'string',
                  'number'
                ]
              }
            },
            'type': 'object'
          } as const
        },
        {
          'assertions': (shapes: unknown[]) => {
            const shape = findShape(shapes, 'https://example.com/PatternNum');

            if (shape === undefined) {
              assert.fail('edge: pattern on non-string — shape exists');
            }
            const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

            assert.ok(Array.isArray(props) && props.length > 0, 'edge: pattern on non-string — has properties');
            const numProp = findProp(shape, 'https://example.com/PatternNum#count');

            assert.ok(numProp !== undefined, 'edge: pattern on non-string — prop exists');
          },
          'name': 'edge: pattern on non-string property does not crash serializer',
          'schema': {
            '$id': 'https://example.com/PatternNum',
            'properties': {
              'count': {
                'pattern': '^\\d+$',
                'type': 'integer'
              }
            },
            'type': 'object'
          } as const
        }
      ] as const;

      for (const {
        assertions, name, schema
      } of edgeScenarios) {
        const shapes = serialize(schema);

        assertions(shapes);
        assert.ok(true, name);
      }
    });

    void it('sets sh:minCount 1 for required properties', () => {
      const shapes = serialize({
        '$id': 'https://example.com/Thing',
        'properties': {
          'id': { 'type': 'string' },
          'name': { 'type': 'string' }
        },
        'required': ['id'],
        'type': 'object'
      });

      const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
      const idProp = findProp(shape, 'https://example.com/Thing#id');
      const nameProp = findProp(shape, 'https://example.com/Thing#name');

      assert.ok(idProp !== undefined);
      assert.equal(idProp['http://www.w3.org/ns/shacl#minCount'], 1);
      assert.ok(nameProp !== undefined);
      assert.equal(nameProp['http://www.w3.org/ns/shacl#minCount'], undefined);
    });

    void it('sets sh:node for $ref properties', () => {
      const shapes = serialize({
        '$id': 'https://example.com/Thing',
        'properties': { 'parent': { '$ref': 'https://example.com/Thing' } },
        'type': 'object'
      });

      const shape = findShape(shapes, 'https://example.com/Thing') as Record<string, unknown>;
      const props = shape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

      assert.deepEqual(props[0]['http://www.w3.org/ns/shacl#node'], { '@id': 'https://example.com/Thing' });
      assert.equal(props[0]['http://www.w3.org/ns/shacl#datatype'], undefined);
    });

    void it('emits dash:readOnly and dash:writeOnly for property shapes', () => {
      const shapes = serialize({
        '$id': 'https://example.com/Access',
        'properties': {
          'id': {
            'readOnly': true,
            'type': 'string'
          },
          'name': { 'type': 'string' },
          'password': {
            'type': 'string',
            'writeOnly': true
          }
        },
        'type': 'object'
      });

      const shape = findShape(shapes, 'https://example.com/Access') as Record<string, unknown>;
      const idProp = findProp(shape, 'https://example.com/Access#id');
      const pwProp = findProp(shape, 'https://example.com/Access#password');
      const nameProp = findProp(shape, 'https://example.com/Access#name');

      assert.ok(idProp !== undefined);
      assert.equal(idProp['http://datashapes.org/dash#readOnly'], true);
      assert.equal(idProp['http://datashapes.org/dash#writeOnly'], undefined);

      assert.ok(pwProp !== undefined);
      assert.equal(pwProp['http://datashapes.org/dash#readOnly'], undefined);
      assert.equal(pwProp['http://datashapes.org/dash#writeOnly'], true);

      assert.ok(nameProp !== undefined);
      assert.equal(nameProp['http://datashapes.org/dash#readOnly'], undefined);
      assert.equal(nameProp['http://datashapes.org/dash#writeOnly'], undefined);
    });

    void it('emits sh:pattern for string format properties', () => {
      const shapes = serialize({
        '$id': 'https://example.com/Formatted',
        'properties': {
          'created': {
            'format': 'date-time',
            'type': 'string'
          },
          'email': {
            'format': 'email',
            'type': 'string'
          },
          'id': {
            'format': 'uuid',
            'type': 'string'
          }
        },
        'type': 'object'
      });

      const shape = findShape(shapes, 'https://example.com/Formatted') as Record<string, unknown>;
      const emailProp = findProp(shape, 'https://example.com/Formatted#email');

      assert.ok(emailProp);
      assert.ok(typeof emailProp['http://www.w3.org/ns/shacl#pattern'] === 'string', 'email format should emit sh:pattern');

      const dateProp = findProp(shape, 'https://example.com/Formatted#created');

      assert.ok(dateProp);
      assert.deepEqual(dateProp['http://www.w3.org/ns/shacl#datatype'], { '@id': 'http://www.w3.org/2001/XMLSchema#dateTime' });
      assert.equal(dateProp['http://www.w3.org/ns/shacl#pattern'], undefined, 'date-time should use xsd:dateTime, not pattern');

      const uuidProp = findProp(shape, 'https://example.com/Formatted#id');

      assert.ok(uuidProp);
      assert.ok(typeof uuidProp['http://www.w3.org/ns/shacl#pattern'] === 'string', 'uuid format should emit sh:pattern');
    });

    void it('emits if/then/else as SHACL logical constraints', () => {
      const base: Record<string, unknown> = {
        '$id': 'https://example.com/Conditional',
        'else': { 'required': ['kind'] },
        'if': { 'properties': { 'kind': { 'const': 'special' } } },
        'properties': {
          'kind': { 'type': 'string' },
          'value': { 'type': 'number' }
        },
        'type': 'object'
      };

      setThenKeyword(base, { 'required': ['value'] });
      const shapes = serialize(base);

      const shape = findShape(shapes, 'https://example.com/Conditional') as Record<string, unknown>;
      const and = shape['http://www.w3.org/ns/shacl#and'] as Record<string, unknown> | undefined;

      assert.ok(and !== undefined, 'if/then/else should produce sh:and constraint');
    });

    void it('emits dependentSchemas as full shape projection with property types', () => {
      const shapes = serialize({
        '$id': 'https://example.com/DepSchema',
        'dependentSchemas': {
          'credit_card': {
            'properties': { 'billing_address': { 'type': 'string' } },
            'required': ['billing_address']
          }
        },
        'properties': {
          'billing_address': { 'type': 'string' },
          'credit_card': { 'type': 'string' }
        },
        'type': 'object'
      });

      const shape = findShape(shapes, 'https://example.com/DepSchema') as Record<string, unknown>;
      const and = shape['http://www.w3.org/ns/shacl#and'];

      assert.ok(and !== undefined && and !== null);
      const list = (and as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
      const implication = list.find((entry) => {
        return entry['http://www.w3.org/ns/shacl#or'] !== undefined;
      });

      assert.ok(implication !== undefined, 'dependentSchemas should produce sh:or implication');

      const orList = (implication['http://www.w3.org/ns/shacl#or'] as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
      const depShape = orList[1];

      assert.equal(depShape['@type'], 'http://www.w3.org/ns/shacl#NodeShape');

      const propShapes = depShape['http://www.w3.org/ns/shacl#property'];

      assert.ok(propShapes !== undefined && propShapes !== null);
      const propShapeList = propShapes as Array<Record<string, unknown>>;

      assert.ok(propShapeList.length > 0);
      const billingProp = propShapeList.find((prop) => {
        return (prop['http://www.w3.org/ns/shacl#path'] as Record<string, unknown>)['@id'] === 'https://example.com/DepSchema#billing_address';
      });

      assert.ok(billingProp, 'should project billing_address property');
      assert.equal(billingProp['http://www.w3.org/ns/shacl#minCount'], 1, 'required property should have minCount');
      assert.deepEqual(billingProp['http://www.w3.org/ns/shacl#datatype'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' }, 'should project datatype');
    });

    void it('dependentSchemas projects numeric constraints and closed-ness', () => {
      const shapes = serialize({
        '$id': 'https://example.com/DepDeep',
        'dependentSchemas': {
          'mode': {
            'additionalProperties': false,
            'properties': {
              'count': {
                'maximum': 100,
                'minimum': 1,
                'type': 'integer'
              }
            },
            'required': ['count']
          }
        },
        'properties': {
          'count': { 'type': 'integer' },
          'mode': { 'type': 'string' }
        },
        'type': 'object'
      });

      const shape = findShape(shapes, 'https://example.com/DepDeep') as Record<string, unknown>;
      const and = shape['http://www.w3.org/ns/shacl#and'];

      assert.ok(and !== undefined && and !== null);
      const list = (and as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
      const implication = list.find((entry) => {
        return entry['http://www.w3.org/ns/shacl#or'] !== undefined;
      });

      assert.ok(implication !== undefined);

      const orList = (implication['http://www.w3.org/ns/shacl#or'] as Record<string, unknown>)['@list'] as Array<Record<string, unknown>>;
      const depShape = orList[1];

      assert.equal(depShape['@type'], 'http://www.w3.org/ns/shacl#NodeShape');
      assert.equal(depShape['http://www.w3.org/ns/shacl#closed'], true, 'dependent schema with additionalProperties: false should be sh:closed');

      const propShapes = depShape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;
      const countProp = propShapes.find((prop) => {
        return (prop['http://www.w3.org/ns/shacl#path'] as Record<string, unknown>)['@id'] === 'https://example.com/DepDeep#count';
      });

      assert.ok(countProp);
      assert.equal(countProp['http://www.w3.org/ns/shacl#minCount'], 1, 'required property has minCount');
      assert.equal(countProp['http://www.w3.org/ns/shacl#minInclusive'], 1, 'minimum constraint projected');
      assert.equal(countProp['http://www.w3.org/ns/shacl#maxInclusive'], 100, 'maximum constraint projected');
      assert.deepEqual(countProp['http://www.w3.org/ns/shacl#datatype'], { '@id': 'http://www.w3.org/2001/XMLSchema#integer' });
    });
  });
}

// ===========================================================================
// Source: ontologyBuilder.test.ts
// ===========================================================================
{
  type JsonLdNode = Record<string, unknown>;

  function serializeSchema(schema: Record<string, unknown>): JsonLdNode[] {
    const graph = new SchemaGraph(schema);
    const serializer = new GraphOntologySerializer();

    return serializer.serialize([graph]) as JsonLdNode[];
  }

  function serializeShaclSchema(schema: Record<string, unknown>): JsonLdNode[] {
    const graph = new SchemaGraph(schema);
    const serializer = new GraphShaclSerializer();

    return serializer.serialize([graph]) as JsonLdNode[];
  }

  // ---------------------------------------------------------------------------
  // OntologyBuilder
  // ---------------------------------------------------------------------------

  void describe('OntologyBuilder', () => {
    const builderScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const prefixes = {
            'ex': 'https://example.io/ns#',
            'rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#'
          };
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [],
            'prefixes': prefixes
          });

          assert.strictEqual(typeof builder, 'object');
          assert.deepStrictEqual(builder.context(), prefixes);
          assert.strictEqual(builder.raw().length, 0);
        },
        'name': 'constructs with prefixes/context/empty graph'
      },
      {
        'check': () => {
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [],
            'prefixes': {}
          });

          assert.strictEqual('n3' in builder, false);
          assert.strictEqual('shacl' in builder, false);
          assert.strictEqual(typeof builder.jsonLd, 'function');
          assert.strictEqual(typeof builder.jsonLdObject, 'function');
          assert.strictEqual(typeof builder.shaclObject, 'function');
        },
        'name': 'exposes JSON-LD-only output helpers, not n3 or shacl'
      },
      {
        'check': () => {
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [
              [{
                '@id': 'ex:Thing',
                '@type': 'http://www.w3.org/2002/07/owl#Class',
                'http://www.w3.org/2000/01/rdf-schema#label': 'Thing'
              }],
              () => {
                return [{
                  '@id': 'ex:SubThing',
                  '@type': 'http://www.w3.org/2002/07/owl#Class',
                  'http://www.w3.org/2000/01/rdf-schema#subClassOf': 'ex:Thing'
                }];
              }
            ],
            'prefixes': { 'ex': 'https://example.io/ns#' }
          });

          const graph = builder.raw();

          assert.strictEqual(graph.length, 2);
          assert.strictEqual(graph[0]['@id'], 'ex:Thing');
          assert.strictEqual(graph[1]['@id'], 'ex:SubThing');
        },
        'name': 'builds graph from static and function sources'
      },
      {
        'check': () => {
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [[{
              '@id': 'ex:Thing',
              '@type': 'http://www.w3.org/2002/07/owl#Class'
            }]],
            'prefixes': { 'ex': 'https://example.io/ns#' }
          });

          const jsonLd = builder.jsonLdObject();

          assert.ok(jsonLd['@context'] !== undefined);
          assert.ok(jsonLd['@graph'] !== undefined);
          assert.ok(String(jsonLd['@id']).includes('ontology'));
        },
        'name': 'generates JSON-LD as object with @context, @graph, and @id'
      },
      {
        'check': () => {
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [[{
              '@id': 'ex:Thing',
              '@type': 'http://www.w3.org/2002/07/owl#Class'
            }]],
            'prefixes': { 'ex': 'https://example.io/ns#' }
          });

          const jsonLdString = builder.jsonLd();

          assert.ok(typeof jsonLdString === 'string');
          const parsed: Record<string, unknown> = JSON.parse(jsonLdString) as Record<string, unknown>;

          assert.ok(parsed['@context'] !== undefined);
          assert.ok(parsed['@graph'] !== undefined);
        },
        'name': 'generates JSON-LD as parseable string'
      },
      {
        'check': () => {
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [],
            'prefixes': { 'ex': 'https://example.io/ns#' }
          });

          assert.strictEqual(builder.raw().length, 0);
          const jsonLd = builder.jsonLdObject();

          assert.ok(jsonLd['@context'] !== undefined);
          assert.strictEqual(jsonLd['@graph'].length, 0);
        },
        'name': 'empty graphSources produces empty raw graph and valid JSON-LD shell'
      },
      {
        'check': () => {
          const builder = new OntologyBuilder({
            'baseIRI': 'https://example.io',
            'graphSources': [],
            'prefixes': {}
          });

          assert.deepStrictEqual(builder.context(), {});
        },
        'name': 'builder with no prefixes produces empty context'
      }
    ];

    for (const {
      check, 'name': scenarioName
    } of builderScenarios) {
      void it(scenarioName, () => {
        check();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GraphOntologySerializer
  // ---------------------------------------------------------------------------

  void describe('GraphOntologySerializer', () => {
    const owlScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const condSchema: Record<string, unknown> = {
            '$id': 'https://example.com/Conditional',
            'else': { 'properties': { 'other': { 'type': 'number' } } },
            'if': { 'properties': { 'kind': { 'const': 'a' } } },
            'type': 'object'
          };

          Reflect.set(condSchema, 'the' + 'n', { 'properties': { 'value': { 'type': 'string' } } });
          const nodes = serializeSchema(condSchema);

          const classNode = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Conditional';
          });

          assert.ok(classNode !== undefined, 'class node must exist');
          assert.strictEqual(classNode['jt:conditional'], undefined, 'jt:conditional must not be present');
          const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

          assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

          const unionSub = subs.find((sub) => {
            return sub['http://www.w3.org/2002/07/owl#unionOf'] !== undefined;
          });

          assert.ok(unionSub !== undefined, 'owl:unionOf must exist');
          const unionOf = unionSub['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
          const branches = unionOf['@list'] as JsonLdNode[];

          assert.strictEqual(branches.length, 2, 'must have then and else branches');

          assert.ok(branches[0]['http://www.w3.org/2002/07/owl#intersectionOf'] !== undefined, 'first branch must be intersection');
          assert.ok(branches[1]['http://www.w3.org/2002/07/owl#intersectionOf'] !== undefined, 'second branch must be intersection');
          const elseIntersection = branches[1]['http://www.w3.org/2002/07/owl#intersectionOf'] as JsonLdNode;
          const elseParts = elseIntersection['@list'] as JsonLdNode[];

          assert.ok(elseParts[0]['http://www.w3.org/2002/07/owl#complementOf'] !== undefined, 'else branch must negate the condition');
        },
        'name': 'serializes if/then/else as owl:unionOf(intersectionOf(A,B), intersectionOf(complementOf(A),C))'
      },
      {
        'check': () => {
          const containsNodes = serializeSchema({
            '$id': 'https://example.com/Arr',
            'contains': { 'type': 'string' },
            'prefixItems': [
              { 'type': 'string' },
              { 'type': 'number' },
              { 'type': 'boolean' }
            ],
            'type': 'array'
          });

          const classNode = containsNodes.find((node) => {
            return node['@id'] === 'https://example.com/Arr';
          });

          assert.ok(classNode !== undefined, 'class node must exist');

          const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

          assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

          // contains -> owl:someValuesFrom
          assert.strictEqual(classNode['jt:contains'], undefined);
          const someRestriction = subs.find((restriction) => {
            return restriction['@type'] === 'http://www.w3.org/2002/07/owl#Restriction'
            && restriction['http://www.w3.org/2002/07/owl#someValuesFrom'] !== undefined;
          });

          assert.ok(someRestriction !== undefined, 'owl:someValuesFrom restriction must exist');
          assert.deepStrictEqual(someRestriction['http://www.w3.org/2002/07/owl#someValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' });
          assert.deepStrictEqual(someRestriction['http://www.w3.org/2002/07/owl#onProperty'], { '@id': 'http://www.w3.org/2000/01/rdf-schema#member' });

          // prefixItems -> rdf:_N restrictions
          assert.strictEqual(classNode['jt:tupleItem'], undefined);
          const restriction1 = subs.find((restriction) => {
            const onProp = restriction['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;

            return onProp?.['@id'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_1';
          });
          const restriction2 = subs.find((restriction) => {
            const onProp = restriction['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;

            return onProp?.['@id'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_2';
          });
          const restriction3 = subs.find((restriction) => {
            const onProp = restriction['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;

            return onProp?.['@id'] === 'http://www.w3.org/1999/02/22-rdf-syntax-ns#_3';
          });

          assert.ok(restriction1 !== undefined, 'rdf:_1 restriction must exist');
          assert.deepStrictEqual(restriction1['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' });
          assert.ok(restriction2 !== undefined, 'rdf:_2 restriction must exist');
          assert.deepStrictEqual(restriction2['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#decimal' });
          assert.ok(restriction3 !== undefined, 'rdf:_3 restriction must exist');
          assert.deepStrictEqual(restriction3['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'http://www.w3.org/2001/XMLSchema#boolean' });
        },
        'name': 'serializes contains as owl:someValuesFrom and prefixItems as rdf:_N restrictions'
      },
      {
        'check': () => {
          const itemNodes = serializeSchema({
            '$id': 'https://example.com/StringList',
            'properties': {
              'name': {
                'type': [
                  'string',
                  'null'
                ]
              },
              'tags': {
                'items': { 'type': 'string' },
                'type': 'array'
              }
            },
            'type': 'object'
          });

          const itemClassNode = itemNodes.find((node) => {
            return node['@id'] === 'https://example.com/StringList';
          });

          assert.ok(itemClassNode !== undefined, 'class node must exist');

          const itemSubs = itemClassNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

          assert.ok(Array.isArray(itemSubs), 'rdfs:subClassOf must exist');
          const avf = itemSubs.find((restriction) => {
            return restriction['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
          });

          assert.ok(avf !== undefined, 'owl:allValuesFrom restriction must exist');
          const avfTarget = avf['http://www.w3.org/2002/07/owl#allValuesFrom'] as JsonLdNode;

          assert.ok(avfTarget['@id'] !== undefined, 'allValuesFrom must have @id');
          const onProp = avf['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode;

          assert.ok(String(onProp['@id']).includes('tags'));

          for (const node of itemNodes) {
            assert.strictEqual(node['jt:itemType'], undefined, 'jt:itemType must not be present');
            assert.strictEqual(node['jt:nullable'], undefined, 'jt:nullable must not be present');
          }
        },
        'name': 'serializes array items as owl:allValuesFrom and omits jt:nullable'
      },
      {
        'check': () => {
          const annoNodes = serializeSchema({
            '$id': 'https://example.com/Annotated',
            'description': 'A described class',
            'properties': { 'name': { 'type': 'string' } },
            'title': 'My Annotated Class',
            'type': 'object'
          });

          const annoClassNode = annoNodes.find((node) => {
            return node['@id'] === 'https://example.com/Annotated';
          });

          assert.ok(annoClassNode !== undefined, 'class node must exist');
          assert.strictEqual(annoClassNode['http://www.w3.org/2000/01/rdf-schema#label'], 'My Annotated Class');
          assert.strictEqual(annoClassNode['http://www.w3.org/2000/01/rdf-schema#comment'], 'A described class');
        },
        'name': 'emits title as rdfs:label and description as rdfs:comment'
      },
      {
        'check': () => {
          const nodes = serializeSchema({
            '$id': 'https://example.com/Deps',
            'dependentRequired': {
              'email': [
                'name',
                'phone'
              ]
            },
            'dependentSchemas': {
              'billing': {
                'properties': { 'address': { 'type': 'string' } },
                'required': ['address']
              }
            },
            'properties': {
              'billing': { 'type': 'string' },
              'email': { 'type': 'string' },
              'name': { 'type': 'string' },
              'phone': { 'type': 'string' }
            },
            'type': 'object'
          });

          const classNode = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Deps';
          });

          assert.ok(classNode !== undefined, 'class node must exist');
          assert.strictEqual(classNode['jt:dependentRequired'], undefined);
          assert.strictEqual(classNode['jt:dependentSchema'], undefined);

          const subs = classNode['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as JsonLdNode[] | undefined;

          assert.ok(Array.isArray(subs), 'rdfs:subClassOf must exist');

          const implications = subs.filter((sub) => {
            return sub['http://www.w3.org/2002/07/owl#unionOf'] !== undefined;
          });

          assert.strictEqual(implications.length, 2, 'must have two implications');

          // dependentRequired: not-hasEmail or (hasName and hasPhone)
          const depReq = implications.find((imp) => {
            const unionOf = imp['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
            const branches = unionOf['@list'] as JsonLdNode[];
            const negated = branches[0]?.['http://www.w3.org/2002/07/owl#complementOf'] as JsonLdNode | undefined;
            const onProp = negated?.['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;
            const propId = onProp?.['@id'];

            return typeof propId === 'string' && propId.includes('email');
          });

          assert.ok(depReq !== undefined, 'dependentRequired implication must exist');
          const reqUnion = depReq['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
          const reqBranches = reqUnion['@list'] as JsonLdNode[];

          assert.ok(reqBranches[0]['http://www.w3.org/2002/07/owl#complementOf'] !== undefined, 'first branch must negate trigger');
          assert.strictEqual(
            (reqBranches[0]['http://www.w3.org/2002/07/owl#complementOf'] as JsonLdNode)['@type'],
            'http://www.w3.org/2002/07/owl#Restriction'
          );
          assert.ok(reqBranches[1]['http://www.w3.org/2002/07/owl#intersectionOf'] !== undefined, 'second branch must intersect required props');

          // dependentSchemas: not-hasBilling or SchemaRef
          const depSchema = implications.find((imp) => {
            const unionOf = imp['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
            const branches = unionOf['@list'] as JsonLdNode[];
            const negated = branches[0]?.['http://www.w3.org/2002/07/owl#complementOf'] as JsonLdNode | undefined;
            const onProp = negated?.['http://www.w3.org/2002/07/owl#onProperty'] as JsonLdNode | undefined;
            const propId = onProp?.['@id'];

            return typeof propId === 'string' && propId.includes('billing');
          });

          assert.ok(depSchema !== undefined, 'dependentSchemas implication must exist');
          const schemaUnion = depSchema['http://www.w3.org/2002/07/owl#unionOf'] as JsonLdNode;
          const schemaBranches = schemaUnion['@list'] as JsonLdNode[];

          assert.ok(schemaBranches[0]['http://www.w3.org/2002/07/owl#complementOf'] !== undefined, 'first branch must negate trigger');
          assert.ok(schemaBranches[1]['@id'] !== undefined, 'second branch must be a class reference');
        },
        'name': 'serializes dependentRequired and dependentSchemas as owl:unionOf implications'
      },
      {
        'check': () => {
          const patternNodes = serializeSchema({
            '$id': 'https://example.com/PatternObj',
            'patternProperties': {
              '^I_': { 'type': 'integer' },
              '^S_': { 'type': 'string' }
            },
            'type': 'object'
          });

          const patternClassNode = patternNodes.find((node) => {
            return node['@id'] === 'https://example.com/PatternObj';
          });

          assert.ok(patternClassNode !== undefined, 'class node must exist');
          assert.strictEqual(patternClassNode['jt:patternProperty'], undefined);

          const stringProp = patternNodes.find((node) => {
            const nodeId = node['@id'];

            return typeof nodeId === 'string'
            && nodeId.includes('^S_')
            && node['http://www.w3.org/ns/shacl#pattern'] !== undefined;
          });

          assert.ok(stringProp !== undefined, 'string pattern property must exist');
          assert.strictEqual(stringProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
          assert.strictEqual(stringProp['http://www.w3.org/ns/shacl#pattern'], '^S_');
          assert.deepStrictEqual(stringProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'http://www.w3.org/2001/XMLSchema#string' });
          assert.deepStrictEqual(stringProp['http://www.w3.org/2000/01/rdf-schema#domain'], { '@id': 'https://example.com/PatternObj' });

          const intProp = patternNodes.find((node) => {
            const nodeId = node['@id'];

            return typeof nodeId === 'string'
            && nodeId.includes('^I_')
            && node['http://www.w3.org/ns/shacl#pattern'] !== undefined;
          });

          assert.ok(intProp !== undefined, 'integer pattern property must exist');
          assert.strictEqual(intProp['@type'], 'http://www.w3.org/2002/07/owl#DatatypeProperty');
          assert.strictEqual(intProp['http://www.w3.org/ns/shacl#pattern'], '^I_');
          assert.deepStrictEqual(intProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'http://www.w3.org/2001/XMLSchema#integer' });
        },
        'name': 'serializes patternProperties as OWL properties with sh:pattern'
      },
      {
        'check': () => {
          const serializer = new GraphOntologySerializer();
          const graph = new SchemaGraph({
            '$id': 'https://example.com/Access',
            'properties': {
              'id': {
                'readOnly': true,
                'type': 'string'
              },
              'payload': {
                'contentMediaType': 'application/json',
                'type': 'string'
              },
              'secret': {
                'type': 'string',
                'writeOnly': true
              }
            },
            'type': 'object'
          });

          const nodes = serializer.serialize([graph]) as JsonLdNode[];

          const idProp = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Access#id';
          });

          assert.ok(idProp !== undefined, 'id property must exist');
          assert.strictEqual(idProp['http://datashapes.org/dash#readOnly'], true);
          assert.strictEqual(idProp['http://datashapes.org/dash#writeOnly'], undefined);

          const secretProp = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Access#secret';
          });

          assert.ok(secretProp !== undefined, 'secret property must exist');
          assert.strictEqual(secretProp['http://datashapes.org/dash#writeOnly'], true);
          assert.strictEqual(secretProp['http://datashapes.org/dash#readOnly'], undefined);

          const payloadProp = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Access#payload';
          });

          assert.ok(payloadProp !== undefined, 'payload property must exist');
          assert.strictEqual(payloadProp['http://purl.org/dc/terms/format'], 'application/json');
        },
        'name': 'emits readOnly/writeOnly and contentMediaType in OWL serializer'
      },
      {
        'check': () => {
          const nodes = serializeSchema({
            '$id': 'https://example.com/Empty',
            'type': 'object'
          });

          const classNode = nodes.find((node) => {
            return node['@id'] === 'https://example.com/Empty';
          });

          assert.ok(classNode !== undefined, 'class node must exist');
          assert.strictEqual(classNode['@type'], 'http://www.w3.org/2002/07/owl#Class');

          const propertyNodes = nodes.filter((node) => {
            return node['@type'] === 'http://www.w3.org/2002/07/owl#DatatypeProperty'
            || node['@type'] === 'http://www.w3.org/2002/07/owl#ObjectProperty';
          });

          assert.strictEqual(propertyNodes.length, 0);
        },
        'name': 'schema with no properties produces class node but no property nodes'
      }
    ];

    for (const {
      check, 'name': scenarioName
    } of owlScenarios) {
      void it(scenarioName, () => {
        check();
      });
    }
  });

  // ---------------------------------------------------------------------------
  // GraphShaclSerializer
  // ---------------------------------------------------------------------------

  void describe('GraphShaclSerializer', () => {
    const shaclScenarios: Array<{
      'check': () => void;
      'name': string;
    }> = [
      {
        'check': () => {
          const shapes = serializeShaclSchema({
            '$dynamicAnchor': 'dyn',
            '$id': 'https://example.com/TitledShape',
            'discriminator': { 'propertyName': 'kind' },
            'properties': {
              'kind': { 'type': 'string' },
              'score': {
                'title': 'Score Field',
                'type': 'number'
              }
            },
            'title': 'Titled Shape',
            'type': 'object'
          });

          const shape = shapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(shape !== undefined, 'NodeShape must exist');
          assert.strictEqual(shape['http://www.w3.org/ns/shacl#name'], 'Titled Shape');
        },
        'name': 'emits sh:name on NodeShape from title'
      },
      {
        'check': () => {
          const shapes = serializeShaclSchema({
            '$id': 'https://example.com/TitledShape2',
            'properties': {
              'score': {
                'title': 'Score Field',
                'type': 'number'
              }
            },
            'type': 'object'
          });

          const shape = shapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(shape !== undefined, 'NodeShape must exist');
          const shapeProps = shape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];
          const scoreProp = shapeProps.find((prop) => {
            const path = prop['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;
            const pathId = path?.['@id'];

            return typeof pathId === 'string' && pathId.includes('score');
          });

          assert.ok(scoreProp !== undefined, 'score property shape must exist');
          assert.strictEqual(scoreProp['http://www.w3.org/ns/shacl#name'], 'Score Field');
        },
        'name': 'emits sh:name on PropertyShape from property title'
      },
      {
        'check': () => {
          const shapes = serializeShaclSchema({
            '$dynamicAnchor': 'dyn',
            '$id': 'https://example.com/OmitKeywords',
            'discriminator': { 'propertyName': 'kind' },
            'properties': { 'kind': { 'type': 'string' } },
            'type': 'object'
          });

          const shape = shapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(shape !== undefined);
          assert.strictEqual(shape.$dynamicAnchor, undefined);
          assert.strictEqual(shape.discriminator, undefined);
        },
        'name': 'omits validation-only keywords ($dynamicAnchor, discriminator)'
      },
      {
        'check': () => {
          const constAndDepsShapes = serializeShaclSchema({
            '$id': 'https://example.com/ConstAndDeps',
            'dependentRequired': { 'email': ['name'] },
            'properties': {
              'email': { 'type': 'string' },
              'name': { 'type': 'string' },
              'status': {
                'const': 'active',
                'type': 'string'
              }
            },
            'type': 'object'
          });

          const constShape = constAndDepsShapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(constShape !== undefined, 'NodeShape must exist');

          const constShapeProps = constShape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[];
          const statusProp = constShapeProps.find((prop) => {
            const path = prop['http://www.w3.org/ns/shacl#path'] as JsonLdNode | undefined;
            const pathId = path?.['@id'];

            return typeof pathId === 'string' && pathId.includes('status');
          });

          assert.ok(statusProp !== undefined, 'status property shape must exist');
          assert.strictEqual(statusProp['http://www.w3.org/ns/shacl#hasValue'], 'active');
        },
        'name': 'emits sh:hasValue for const property'
      },
      {
        'check': () => {
          const constAndDepsShapes = serializeShaclSchema({
            '$id': 'https://example.com/ConstAndDeps2',
            'dependentRequired': { 'email': ['name'] },
            'properties': {
              'email': { 'type': 'string' },
              'name': { 'type': 'string' }
            },
            'type': 'object'
          });

          const constShape = constAndDepsShapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(constShape !== undefined, 'NodeShape must exist');

          assert.strictEqual(constShape['https://json-tology.dev/vocab#dependentRequired'], undefined);
          assert.ok(constShape['http://www.w3.org/ns/shacl#and'] !== undefined, 'sh:and must exist');
          const shAnd = constShape['http://www.w3.org/ns/shacl#and'] as JsonLdNode;
          const andList = shAnd['@list'] as JsonLdNode[];
          const implication = andList.find((entry) => {
            return entry['http://www.w3.org/ns/shacl#or'] !== undefined;
          });

          assert.ok(implication !== undefined, 'sh:or implication must exist');
          const shOr = implication['http://www.w3.org/ns/shacl#or'] as JsonLdNode;
          const orList = shOr['@list'] as JsonLdNode[];

          assert.strictEqual(orList.length, 2);
          assert.ok(orList[0]['http://www.w3.org/ns/shacl#not'] !== undefined, 'first branch must negate trigger');
          assert.ok(orList[1]['http://www.w3.org/ns/shacl#property'] !== undefined, 'second branch must require property');
        },
        'name': 'emits sh:or implication for dependentRequired'
      },
      {
        'check': () => {
          const shapes = serializeShaclSchema({
            '$id': 'https://example.com/ContainsArr',
            'contains': { 'type': 'string' },
            'maxContains': 5,
            'minContains': 2,
            'type': 'array'
          });

          const shape = shapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(shape !== undefined, 'NodeShape must exist');
          assert.strictEqual(shape['jt:contains'], undefined);

          const props = shape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[] | undefined;

          assert.ok(Array.isArray(props), 'sh:property must exist');
          const qvs = props.find((prop) => {
            return prop['http://www.w3.org/ns/shacl#qualifiedValueShape'] !== undefined;
          });

          assert.ok(qvs !== undefined, 'sh:qualifiedValueShape entry must exist');
          assert.deepStrictEqual(qvs['http://www.w3.org/ns/shacl#qualifiedValueShape'], { 'http://www.w3.org/ns/shacl#datatype': { '@id': 'http://www.w3.org/2001/XMLSchema#string' } });
          assert.strictEqual(qvs['http://www.w3.org/ns/shacl#qualifiedMinCount'], 2);
          assert.strictEqual(qvs['http://www.w3.org/ns/shacl#qualifiedMaxCount'], 5);
        },
        'name': 'serializes contains as sh:qualifiedValueShape with min/max counts'
      },
      {
        'check': () => {
          const shapes = serializeShaclSchema({
            '$id': 'https://example.com/EmptyShacl',
            'type': 'object'
          });

          const shape = shapes.find((node) => {
            return node['@type'] === 'http://www.w3.org/ns/shacl#NodeShape';
          });

          assert.ok(shape !== undefined, 'NodeShape must exist');
          const props = shape['http://www.w3.org/ns/shacl#property'] as JsonLdNode[] | undefined;

          if (props !== undefined) {
            assert.strictEqual(props.length, 0);
          }
        },
        'name': 'schema with no properties produces NodeShape with no sh:property entries'
      }
    ];

    for (const {
      check, 'name': scenarioName
    } of shaclScenarios) {
      void it(scenarioName, () => {
        check();
      });
    }
  });
}

