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

void describe('GraphSchemaSerializer', () => {
  const serializer = new GraphSchemaSerializer();

  void it('roundtrips basic object schema, $defs, $anchor, required, and array items', () => {
    const schema = {
      '$id': 'https://example.com/Basic',
      'properties': {
        'count': { 'type': 'number' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const result = serializer.serialize(graph);

    assert.equal(result.$id, 'https://example.com/Basic');
    assert.equal(result.type, 'object');
    const props = result.properties as Record<string, Record<string, unknown>>;

    assert.deepEqual(props.name, { 'type': 'string' });
    assert.deepEqual(props.count, { 'type': 'number' });

    // $defs
    const defsSchema = {
      '$defs': {
        'Address': {
          'properties': { 'street': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://example.com/WithDefs',
      'properties': { 'home': { '$ref': '#/$defs/Address' } },
      'type': 'object'
    };
    const defsResult = serializer.serialize(new SchemaGraph(defsSchema));

    assert.ok(defsResult.$defs !== undefined);
    const defs = defsResult.$defs as Record<string, Record<string, unknown>>;

    assert.equal(defs.Address.type, 'object');
    const addrProps = defs.Address.properties as Record<string, Record<string, unknown>>;

    assert.deepEqual(addrProps.street, { 'type': 'string' });

    // $anchor
    const anchorSchema = {
      '$id': 'https://example.com/Anchored',
      'properties': {
        'tag': {
          '$anchor': 'tag-node',
          'type': 'string'
        }
      },
      'type': 'object'
    };
    const anchorResult = serializer.serialize(new SchemaGraph(anchorSchema));
    const anchorProps = anchorResult.properties as Record<string, Record<string, unknown>>;

    assert.equal(anchorProps.tag.$anchor, 'tag-node');

    // required
    const reqSchema = {
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
    };

    assert.deepEqual(serializer.serialize(new SchemaGraph(reqSchema)).required, [
      'id',
      'name'
    ]);

    // array items
    const arrSchema = {
      '$id': 'https://example.com/Arr',
      'items': { 'type': 'string' },
      'type': 'array'
    };
    const arrResult = serializer.serialize(new SchemaGraph(arrSchema));

    assert.equal(arrResult.type, 'array');
    assert.deepEqual(arrResult.items, { 'type': 'string' });
  });

  void it('preserves allOf/anyOf/oneOf composition, pattern, format, numeric constraints, enum, const, title, description', () => {
    // composition
    for (const keyword of [
      'allOf',
      'anyOf',
      'oneOf'
    ] as const) {
      const schema = {
        '$id': `https://example.com/${keyword}`,
        [keyword]: [
          { 'type': 'string' },
          { 'type': 'number' }
        ]
      };
      const result = serializer.serialize(new SchemaGraph(schema));

      assert.ok(Array.isArray(result[keyword]));
      assert.equal((result[keyword]).length, 2);
    }

    // pattern, format
    const constrained = serializer.serialize(new SchemaGraph({
      '$id': 'https://example.com/Constrained',
      'format': 'email',
      'pattern': '^[a-z]+$',
      'type': 'string'
    }));

    assert.equal(constrained.pattern, '^[a-z]+$');
    assert.equal(constrained.format, 'email');

    // numeric constraints
    const numeric = serializer.serialize(new SchemaGraph({
      '$id': 'https://example.com/Numeric',
      'maximum': 100,
      'minimum': 0,
      'multipleOf': 5,
      'type': 'number'
    }));

    assert.equal(numeric.minimum, 0);
    assert.equal(numeric.maximum, 100);
    assert.equal(numeric.multipleOf, 5);

    // enum
    const enumResult = serializer.serialize(new SchemaGraph({
      '$id': 'https://example.com/Enum',
      'enum': [
        'red',
        'green',
        'blue'
      ],
      'type': 'string'
    }));

    assert.deepEqual(enumResult.enum, [
      'red',
      'green',
      'blue'
    ]);

    // const
    const constResult = serializer.serialize(new SchemaGraph({
      '$id': 'https://example.com/Const',
      'const': 'fixed'
    }));

    assert.equal(constResult.const, 'fixed');

    // title, description
    const meta = serializer.serialize(new SchemaGraph({
      '$id': 'https://example.com/Meta',
      'description': 'A description',
      'title': 'A title',
      'type': 'string'
    }));

    assert.equal(meta.title, 'A title');
    assert.equal(meta.description, 'A description');
  });

  void it('roundtrips graph identity: stable output, preserves $id, $defs, anchors, refs, pointers', () => {
    const schema = {
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
    };

    const first = roundtrip(schema);
    const second = roundtrip(first);

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
  });

  void it('preserves $comment, custom keywords, examples, definitions, additionalItems, $recursiveAnchor/$recursiveRef', () => {
    // $comment on root and nested
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

    // custom keywords
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

    // custom keywords roundtrip through two passes
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

    // examples on root and nested
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

    // definitions (draft-07 alias)
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
    const defDefs = (defResult.definitions ?? defResult.$defs) as Record<string, Record<string, unknown>> | undefined;

    assert.ok(defDefs !== undefined);
    assert.equal(defDefs.Addr.type, 'object');
    const defAddrProps = defDefs.Addr.properties as Record<string, Record<string, unknown>>;

    assert.deepEqual(defAddrProps.street, { 'type': 'string' });

    // additionalItems
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

    // $recursiveAnchor and $recursiveRef
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
  });

  void it('roundtrips discriminator with and without mapping', () => {
    const scenarios = [
      {
        'expected': {
          'mapping': {
            'cat': '#/$defs/Cat',
            'dog': '#/$defs/Dog'
          },
          'propertyName': 'kind'
        },
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
        }
      },
      {
        'expected': {
          'mapping': undefined,
          'propertyName': 'kind'
        },
        'name': 'without mapping',
        'schema': {
          '$id': 'https://example.com/DiscNoMap',
          'discriminator': { 'propertyName': 'kind' },
          'oneOf': [{
            'properties': { 'kind': { 'const': 'a' } },
            'type': 'object'
          }]
        }
      }
    ] as const;

    for (const scenario of scenarios) {
      const result = roundtrip(scenario.schema as unknown as Record<string, unknown>);
      const disc = result.discriminator as Record<string, unknown>;

      assert.ok(typeof disc === 'object', `${scenario.name}: discriminator must be object`);
      assert.equal(disc.propertyName, scenario.expected.propertyName, `${scenario.name}: propertyName`);
      assert.deepEqual(disc.mapping, scenario.expected.mapping, `${scenario.name}: mapping`);

      // Stable across two passes (with mapping)
      if (scenario.expected.mapping !== undefined) {
        const second = roundtrip(result);

        assert.deepEqual(result, second);
      }
    }
  });

  void it('roundtrips custom keywords and examples through JsonTology.toSchema()', () => {
    // custom keywords
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

    // examples
    const exSchema = {
      '$id': 'https://example.com/E2E-Examples',
      'examples': [
        'hello',
        'world'
      ],
      'type': 'string'
    };
    const jt2 = JsonTology.create({
      'baseIRI': 'https://example.com',
      'schemas': [exSchema] as const
    });
    const exResult = jt2.toSchema(exSchema.$id);

    assert.ok(exResult !== undefined);
    assert.deepEqual(exResult.examples, [
      'hello',
      'world'
    ]);
  });
});
