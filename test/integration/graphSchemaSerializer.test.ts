import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { GraphSchemaSerializer } from '../../src/modules/ontology/graphSchemaSerializer.js';
import { SchemaGraph } from '../../src/modules/graph/schemaGraph.js';

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
