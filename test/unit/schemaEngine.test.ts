import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';

void describe('Graph engine advanced keywords', () => {
  void it('supports propertyNames with pattern and length constraints', () => {
    const registry = new SchemaRegistry();
    const scenarios: Array<[Record<string, unknown>, Record<string, unknown>, boolean]> = [
      [
        {
          '$id': 'urn:test:pn-1',
          'propertyNames': {
            'pattern': '^[a-z]+$',
            'type': 'string'
          },
          'type': 'object'
        },
        { 'good': 1 },
        true
      ],
      [
        {
          '$id': 'urn:test:pn-2',
          'propertyNames': {
            'pattern': '^[a-z]+$',
            'type': 'string'
          },
          'type': 'object'
        },
        { 'Bad-Key': 1 },
        false
      ],
      [
        {
          '$id': 'urn:test:pn-3',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        },
        {
          'barbaz': 2,
          'foo': 1
        },
        true
      ],
      [
        {
          '$id': 'urn:test:pn-4',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        },
        { 'ab': 1 },
        false
      ],
      [
        {
          '$id': 'urn:test:pn-5',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        },
        { 'thisnameiswaytoolong': 1 },
        false
      ],
      [
        {
          '$id': 'urn:test:pn-6',
          'propertyNames': {
            'maxLength': 10,
            'minLength': 3
          },
          'type': 'object'
        },
        {},
        true
      ]
    ];

    for (const [
      schema,
      data,
      expected
    ] of scenarios) {
      registry.register(schema);
      assert.equal(registry.is(schema.$id as string, data), expected);
    }
  });

  void it('supports dependentSchemas with $ref', () => {
    const registry = new SchemaRegistry();
    const kindDepSchema = {
      '$id': 'urn:test:dependent-schemas-kind-dep',
      'properties': {
        'kind': { 'const': 'business' },
        'taxId': { 'type': 'string' }
      },
      'required': ['taxId'],
      'type': 'object'
    } as const;
    const schema = {
      '$id': 'urn:test:dependent-schemas',
      'dependentSchemas': { 'kind': { '$ref': 'urn:test:dependent-schemas-kind-dep' } },
      'type': 'object'
    } as const;

    registry.register([
      kindDepSchema,
      schema
    ]);
    assert.equal(registry.is(schema.$id, {
      'kind': 'business',
      'taxId': '123'
    }), true);
    assert.equal(registry.is(schema.$id, { 'kind': 'business' }), false);
  });

  void it('supports prefixItems with items:false tail constraint', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:prefix-items',
      'items': false,
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'type': 'array'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [
      'x',
      1
    ]), true);
    assert.equal(registry.is(schema.$id, [
      'x',
      1,
      true
    ]), false);
  });

  void it('supports contains with minContains/maxContains edge cases', () => {
    const registry = new SchemaRegistry();
    const schema1 = {
      '$id': 'urn:test:contains-min-max',
      'contains': { 'type': 'number' },
      'maxContains': 3,
      'minContains': 2,
      'type': 'array'
    } as const;

    registry.register(schema1);
    assert.equal(registry.is(schema1.$id, [
      1,
      2,
      'x'
    ]), true);
    assert.equal(registry.is(schema1.$id, [
      1,
      'x'
    ]), false);
    assert.equal(registry.is(schema1.$id, [
      1,
      2,
      3,
      4
    ]), false);

    // minContains: 0 always passes
    const schema2 = {
      '$id': 'urn:test:contains-min-zero',
      'contains': { 'type': 'string' },
      'minContains': 0,
      'type': 'array'
    };

    registry.register(schema2);
    assert.equal(registry.is(schema2.$id, []), true);
    assert.equal(registry.is(schema2.$id, [
      1,
      2,
      3
    ]), true);
  });

  void it('supports uniqueItems with semantic object equality', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unique-items',
      'type': 'array',
      'uniqueItems': true
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [
      1,
      2,
      3
    ]), true);
    assert.equal(registry.is(schema.$id, [
      1,
      2,
      1
    ]), false);
    assert.equal(registry.is(schema.$id, [
      {
        'a': 1,
        'b': 2
      },
      {
        'a': 1,
        'b': 2
      }
    ]), false);
  });

  void it('supports if/then/else with $ref and unevaluatedProperties interaction', () => {
    const registry = new SchemaRegistry();

    // $ref-based if/then/else
    const ifSchema = {
      '$id': 'urn:test:ite-if',
      'properties': { 'kind': { 'const': 'business' } },
      'type': 'object'
    } as const;
    const thenSchema = {
      '$id': 'urn:test:ite-then',
      'properties': { 'taxId': { 'type': 'string' } },
      'required': ['taxId'],
      'type': 'object'
    } as const;
    const elseSchema = {
      '$id': 'urn:test:ite-else',
      'properties': { 'ssn': { 'type': 'string' } },
      'required': ['ssn'],
      'type': 'object'
    } as const;
    const schema = {
      '$id': 'urn:test:if-then-else',
      'else': { '$ref': 'urn:test:ite-else' },
      'if': { '$ref': 'urn:test:ite-if' },
      // eslint-disable-next-line unicorn/no-thenable
      'then': { '$ref': 'urn:test:ite-then' },
      'type': 'object'
    } as const;

    registry.register([
      ifSchema,
      thenSchema,
      elseSchema,
      schema
    ]);
    assert.equal(registry.is(schema.$id, {
      'kind': 'business',
      'taxId': '123'
    }), true);
    assert.equal(registry.is(schema.$id, { 'kind': 'business' }), false);
    assert.equal(registry.is(schema.$id, {
      'kind': 'person',
      'ssn': '999'
    }), true);
    assert.equal(registry.is(schema.$id, { 'kind': 'person' }), false);

    // if/then/else with unevaluatedProperties
    const unevalSchema = {
      '$id': 'urn:test:if-then-unevaluated',
      'if': { 'properties': { 'type': { 'const': 'admin' } } },
      'properties': { 'type': { 'type': 'string' } },
      'required': ['type'],
      // eslint-disable-next-line unicorn/no-thenable
      'then': {
        'properties': { 'level': { 'type': 'number' } },
        'required': ['level']
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(unevalSchema);
    assert.equal(registry.is(unevalSchema.$id, {
      'level': 5,
      'type': 'admin'
    }), true);
    assert.equal(registry.is(unevalSchema.$id, { 'type': 'user' }), true);
    assert.equal(registry.is(unevalSchema.$id, {
      'extra': 1,
      'level': 5,
      'type': 'admin'
    }), false);
  });

  void it('supports extended format assertions (string and numeric)', () => {
    const registry = new SchemaRegistry();
    const scenarios: Array<[Record<string, unknown>, unknown, boolean]> = [
      [
        {
          '$id': 'urn:test:fmt-dur',
          'format': 'duration',
          'type': 'string'
        },
        'P3DT4H',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-dur2',
          'format': 'duration',
          'type': 'string'
        },
        'three days',
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-ipv6',
          'format': 'ipv6',
          'type': 'string'
        },
        '2001:db8::1',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-ipv6-2',
          'format': 'ipv6',
          'type': 'string'
        },
        '999.1.1.1',
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-uriref',
          'format': 'uri-reference',
          'type': 'string'
        },
        '/users/123?draft=true',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-uritpl',
          'format': 'uri-template',
          'type': 'string'
        },
        '/users/{id}',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-uritpl2',
          'format': 'uri-template',
          'type': 'string'
        },
        '/users/{id',
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-jptr',
          'format': 'json-pointer',
          'type': 'string'
        },
        '/items/0/name',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-jptr2',
          'format': 'json-pointer',
          'type': 'string'
        },
        'items/0/name',
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-regex',
          'format': 'regex',
          'type': 'string'
        },
        '^[a-z]+$',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-regex2',
          'format': 'regex',
          'type': 'string'
        },
        '[',
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-byte',
          'format': 'byte',
          'type': 'string'
        },
        'SGVsbG8=',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-bin',
          'format': 'binary',
          'type': 'string'
        },
        '0aff',
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-bin2',
          'format': 'binary',
          'type': 'string'
        },
        'xyz',
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-i32',
          'format': 'int32',
          'type': 'integer'
        },
        2_147_483_647,
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-i32-2',
          'format': 'int32',
          'type': 'integer'
        },
        2_147_483_648,
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-i64',
          'format': 'int64',
          'type': 'integer'
        },
        Number.MAX_SAFE_INTEGER,
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-i64-2',
          'format': 'int64',
          'type': 'integer'
        },
        Number.MAX_SAFE_INTEGER + 1,
        false
      ],
      [
        {
          '$id': 'urn:test:fmt-f',
          'format': 'float',
          'type': 'number'
        },
        Math.fround(1.5),
        true
      ],
      [
        {
          '$id': 'urn:test:fmt-f2',
          'format': 'float',
          'type': 'number'
        },
        1e40,
        false
      ]
    ];

    for (const [
      schema,
      data,
      expected
    ] of scenarios) {
      registry.register(schema);
      assert.equal(registry.is(schema.$id as string, data), expected);
    }
  });

  void it('rejects unsupported dialects and unknown required vocabularies', () => {
    assert.throws(() => {
      new GraphEngine({
        '$schema': 'http://json-schema.org/draft-07/schema#',
        'type': 'string'
      });
    }, /Unsupported JSON Schema dialect/u);

    assert.throws(() => {
      new GraphEngine({
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': { 'https://example.io/vocab/custom-required': true },
        'type': 'string'
      });
    }, /Unsupported required JSON Schema vocabulary/u);
  });

  void it('handles format annotation vs assertion and content annotations per 2020-12 vocabulary', () => {
    const registry = new SchemaRegistry();

    // Without format-assertion: format is annotation-only
    const annotationSchema = {
      '$id': 'urn:test:format-annotation',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'format': 'email',
      'type': 'string'
    } as const;

    registry.register(annotationSchema);
    assert.equal(registry.is(annotationSchema.$id, 'not-an-email'), true);

    // With format-assertion vocabulary: format is enforced
    const assertionSchema = {
      '$id': 'urn:test:format-assertion-vocab',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/content': true,
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
        'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
        'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'format': 'email',
      'type': 'string'
    } as const;

    registry.register(assertionSchema);
    assert.equal(registry.is(assertionSchema.$id, 'alice@example.io'), true);
    assert.equal(registry.is(assertionSchema.$id, 'not-an-email'), false);

    // Content keywords are annotations, not assertions
    const contentInnerSchema = {
      '$id': 'urn:test:content-inner',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;
    const contentSchema = {
      '$id': 'urn:test:content-annotations',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'contentEncoding': 'base64',
      'contentMediaType': 'application/json',
      'contentSchema': { '$ref': 'urn:test:content-inner' },
      'type': 'string'
    } as const;

    registry.register([
      contentInnerSchema,
      contentSchema
    ]);
    assert.equal(registry.is(contentSchema.$id, 'definitely not base64 or json'), true);
  });

  void it('supports unevaluatedProperties/Items with allOf, anyOf, and conditional tracking', () => {
    const registry = new SchemaRegistry();

    // Basic unevaluatedProperties
    const propsSchema = {
      '$id': 'urn:test:unevaluated-props',
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(propsSchema);
    assert.equal(registry.is(propsSchema.$id, { 'name': 'Alice' }), true);
    assert.equal(registry.is(propsSchema.$id, {
      'extra': true,
      'name': 'Alice'
    }), false);

    // Basic unevaluatedItems
    const itemsSchema = {
      '$id': 'urn:test:unevaluated-items',
      'contains': { 'type': 'number' },
      'type': 'array',
      'unevaluatedItems': false
    } as const;

    registry.register(itemsSchema);
    assert.equal(registry.is(itemsSchema.$id, [1]), true);
    assert.equal(registry.is(itemsSchema.$id, [
      1,
      'x'
    ]), false);

    // allOf tracking
    const allOfSchema = {
      '$id': 'urn:test:unevaluated-allof',
      'allOf': [{
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name']
      }],
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(allOfSchema);
    assert.equal(registry.is(allOfSchema.$id, { 'name': 'Alice' }), true);
    assert.equal(registry.is(allOfSchema.$id, {
      'extra': 1,
      'name': 'Alice'
    }), false);

    // anyOf tracking
    const anyOfSchema = {
      '$id': 'urn:test:unevaluated-anyof',
      'anyOf': [
        {
          'properties': { 'a': { 'type': 'string' } },
          'required': ['a']
        },
        {
          'properties': { 'b': { 'type': 'number' } },
          'required': ['b']
        }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(anyOfSchema);
    assert.equal(registry.is(anyOfSchema.$id, { 'a': 'hello' }), true);
    assert.equal(registry.is(anyOfSchema.$id, { 'b': 42 }), true);
    assert.equal(registry.is(anyOfSchema.$id, {
      'a': 'hello',
      'extra': 1
    }), false);

    // anyOf multi-branch
    const anyOfMultiSchema = {
      '$id': 'urn:test:unevaluated-anyof-multi',
      'anyOf': [
        { 'properties': { 'a': { 'type': 'string' } } },
        { 'properties': { 'b': { 'type': 'number' } } }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(anyOfMultiSchema);
    assert.equal(registry.is(anyOfMultiSchema.$id, {
      'a': 'hi',
      'b': 1
    }), true);
    assert.equal(registry.is(anyOfMultiSchema.$id, {
      'a': 'hi',
      'b': 1,
      'c': true
    }), false);

    // allOf items tracking
    const allOfItemsSchema = {
      '$id': 'urn:test:unevaluated-items-allof',
      'allOf': [{ 'prefixItems': [{ 'type': 'string' }] }],
      'type': 'array',
      'unevaluatedItems': false
    } as const;

    registry.register(allOfItemsSchema);
    assert.equal(registry.is(allOfItemsSchema.$id, ['hello']), true);
    assert.equal(registry.is(allOfItemsSchema.$id, [
      'hello',
      42
    ]), false);

    // Conditional tracking
    const condSchema = {
      '$id': 'urn:test:unevaluated-conditional',
      'else': { 'properties': { 'bValue': { 'type': 'string' } } },
      'if': { 'properties': { 'kind': { 'const': 'a' } } },
      'properties': { 'kind': { 'type': 'string' } },
      'required': ['kind'],
      // eslint-disable-next-line unicorn/no-thenable
      'then': { 'properties': { 'aValue': { 'type': 'number' } } },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(condSchema);
    assert.equal(registry.is(condSchema.$id, {
      'aValue': 1,
      'kind': 'a'
    }), true);
    assert.equal(registry.is(condSchema.$id, {
      'bValue': 'x',
      'kind': 'b'
    }), true);
    assert.equal(registry.is(condSchema.$id, {
      'aValue': 1,
      'extra': true,
      'kind': 'a'
    }), false);
  });

  void it('supports local/external anchor and dynamic refs with scope override', () => {
    const registry = new SchemaRegistry();

    // Local anchor
    const localSchema = {
      '$defs': {
        'named': {
          '$anchor': 'namedAddress',
          'properties': { 'street': { 'type': 'string' } },
          'required': ['street'],
          'type': 'object'
        }
      },
      '$id': 'urn:test:local-anchor-refs',
      'properties': { 'address': { '$ref': '#namedAddress' } },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register(localSchema);
    assert.equal(registry.is(localSchema.$id, { 'address': { 'street': '1 Main' } }), true);
    assert.equal(registry.is(localSchema.$id, { 'address': {} }), false);

    // External anchor
    const addressSchema = {
      '$anchor': 'sharedAddress',
      '$id': 'https://example.io/AddressAnchored',
      'properties': { 'street': { 'type': 'string' } },
      'required': ['street'],
      'type': 'object'
    } as const;
    const userSchema = {
      '$id': 'https://example.io/UserWithAnchoredAddress',
      'properties': { 'address': { '$ref': 'https://example.io/AddressAnchored#sharedAddress' } },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([
      addressSchema,
      userSchema
    ]);
    assert.deepEqual(registry.validate(userSchema.$id, { 'address': { 'street': '1 Main' } }), []);
    assert.notDeepEqual(registry.validate(userSchema.$id, { 'address': {} }), []);

    // Local dynamic ref
    const localDynSchema = {
      '$dynamicAnchor': 'node',
      '$id': 'urn:test:local-dynamic-refs',
      'properties': {
        'child': { '$dynamicRef': '#node' },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    } as const;

    registry.register(localDynSchema);
    assert.equal(registry.is(localDynSchema.$id, {
      'child': { 'value': 2 },
      'value': 1
    }), true);
    assert.equal(registry.is(localDynSchema.$id, {
      'child': {},
      'value': 1
    }), false);

    // Dynamic scope override (strict tree)
    const treeSchema = {
      '$dynamicAnchor': 'node',
      '$id': 'https://example.io/tree',
      'properties': {
        'children': {
          'items': { '$dynamicRef': '#node' },
          'type': 'array'
        },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    } as const;
    const tagMixinSchema = {
      '$id': 'https://example.io/tag-mixin',
      'properties': { 'tag': { 'type': 'string' } },
      'required': ['tag'],
      'type': 'object'
    } as const;
    const strictTreeSchema = {
      '$dynamicAnchor': 'node',
      '$id': 'https://example.io/strict-tree',
      'allOf': [
        { '$ref': 'https://example.io/tree' },
        { '$ref': 'https://example.io/tag-mixin' }
      ],
      'type': 'object'
    } as const;

    registry.register([
      treeSchema,
      tagMixinSchema,
      strictTreeSchema
    ]);
    assert.deepEqual(registry.validate(strictTreeSchema.$id, {
      'children': [{
        'tag': 'child',
        'value': 2
      }],
      'tag': 'root',
      'value': 1
    }), []);
    assert.notDeepEqual(registry.validate(strictTreeSchema.$id, {
      'children': [{ 'value': 2 }],
      'tag': 'root',
      'value': 1
    }), []);

    // External dynamic ref
    const dynAddressSchema = {
      '$dynamicAnchor': 'addressNode',
      '$id': 'https://example.io/dynamic-address',
      'properties': { 'street': { 'type': 'string' } },
      'required': ['street'],
      'type': 'object'
    } as const;
    const dynUserSchema = {
      '$id': 'https://example.io/dynamic-user',
      'properties': { 'address': { '$dynamicRef': 'https://example.io/dynamic-address#addressNode' } },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([
      dynAddressSchema,
      dynUserSchema
    ]);
    assert.deepEqual(registry.validate(dynUserSchema.$id, { 'address': { 'street': '1 Main' } }), []);
    assert.notDeepEqual(registry.validate(dynUserSchema.$id, { 'address': {} }), []);
  });

  void it('supports boolean schemas, Unicode code-point length, and composition boundaries', () => {
    const registry = new SchemaRegistry();

    // Boolean schemas
    const trueSchema = { '$id': 'urn:test:bool-true' } as const;
    const falseSchema = {
      '$id': 'urn:test:bool-false',
      'not': {}
    } as const;

    registry.register([
      trueSchema,
      falseSchema
    ]);
    assert.equal(registry.is(trueSchema.$id, { 'anything': true }), true);
    assert.equal(registry.is(falseSchema.$id, { 'anything': true }), false);

    // Unicode code-point length
    const unicodeSchema = {
      '$id': 'urn:test:unicode-length',
      'maxLength': 1,
      'type': 'string'
    } as const;

    registry.register(unicodeSchema);
    assert.equal(registry.is(unicodeSchema.$id, '\u{1F600}'), true);
    assert.equal(registry.is(unicodeSchema.$id, '\u{1F600}a'), false);

    // Boolean schemas at composition boundaries
    const allOfTrue = {
      '$id': 'urn:test:allof-true',
      'allOf': [true]
    } as const;
    const allOfFalse = {
      '$id': 'urn:test:allof-false',
      'allOf': [false]
    } as const;
    const allOfTF = {
      '$id': 'urn:test:allof-true-false',
      'allOf': [
        true,
        false
      ]
    } as const;

    registry.register([
      allOfTrue,
      allOfFalse,
      allOfTF
    ]);
    assert.equal(registry.is(allOfTrue.$id, 'hello'), true);
    assert.equal(registry.is(allOfTrue.$id, null), true);
    assert.equal(registry.is(allOfFalse.$id, 'hello'), false);
    assert.equal(registry.is(allOfTF.$id, 'hello'), false);
  });

  void it('handles nested $ref chains and additionalProperties with allOf', () => {
    const registry = new SchemaRegistry();

    // A → B → C chain
    const schemaC = {
      '$id': 'https://example.io/C',
      'properties': { 'value': { 'type': 'number' } },
      'required': ['value'],
      'type': 'object'
    };
    const schemaB = {
      '$id': 'https://example.io/B',
      'properties': { 'nested': { '$ref': 'https://example.io/C' } },
      'required': ['nested'],
      'type': 'object'
    };
    const schemaA = {
      '$id': 'https://example.io/A',
      'properties': { 'inner': { '$ref': 'https://example.io/B' } },
      'required': ['inner'],
      'type': 'object'
    };

    registry.register([
      schemaC,
      schemaB,
      schemaA
    ]);
    assert.deepEqual(registry.validate('https://example.io/A', { 'inner': { 'nested': { 'value': 42 } } }), []);
    assert.notDeepEqual(registry.validate('https://example.io/A', { 'inner': { 'nested': { 'value': 'not a number' } } }), []);
    assert.notDeepEqual(registry.validate('https://example.io/A', { 'inner': {} }), []);

    // additionalProperties: false with allOf considers only local properties
    const addlSchema = {
      '$id': 'urn:test:additional-allof',
      'additionalProperties': false,
      'allOf': [{ 'properties': { 'b': { 'type': 'number' } } }],
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    } as const;

    registry.register(addlSchema);
    assert.equal(registry.is(addlSchema.$id, { 'a': 'hello' }), true);
    assert.equal(registry.is(addlSchema.$id, {
      'a': 'hello',
      'b': 1
    }), false);
  });
});

void describe('Discriminator-based oneOf optimization', () => {
  const CircleSchema = {
    '$id': 'urn:test:circle',
    'properties': {
      'kind': {
        'const': 'circle',
        'type': 'string'
      },
      'radius': { 'type': 'number' }
    },
    'required': [
      'kind',
      'radius'
    ],
    'type': 'object'
  } as const;

  const RectSchema = {
    '$id': 'urn:test:rect',
    'properties': {
      'height': { 'type': 'number' },
      'kind': {
        'const': 'rect',
        'type': 'string'
      },
      'width': { 'type': 'number' }
    },
    'required': [
      'kind',
      'width',
      'height'
    ],
    'type': 'object'
  } as const;

  const discriminatedSchema = {
    '$id': 'urn:test:discriminated-oneof',
    'discriminator': { 'propertyName': 'kind' },
    'oneOf': [
      { '$ref': 'urn:test:circle' },
      { '$ref': 'urn:test:rect' }
    ]
  } as const;

  const plainOneOfSchema = {
    '$id': 'urn:test:plain-oneof',
    'oneOf': [
      { '$ref': 'urn:test:circle' },
      { '$ref': 'urn:test:rect' }
    ]
  } as const;

  function registerAll(registry: SchemaRegistry) {
    registry.register([
      CircleSchema,
      RectSchema,
      discriminatedSchema,
      plainOneOfSchema
    ]);
  }

  void it('validates, rejects, falls back, and works without discriminator', () => {
    const registry = new SchemaRegistry();

    registerAll(registry);

    // Discriminated: valid variants
    assert.equal(registry.is(discriminatedSchema.$id, {
      'kind': 'circle',
      'radius': 5
    }), true);
    assert.equal(registry.is(discriminatedSchema.$id, {
      'height': 20,
      'kind': 'rect',
      'width': 10
    }), true);
    // Missing required, unknown discriminator, missing discriminator, non-object
    assert.equal(registry.is(discriminatedSchema.$id, { 'kind': 'circle' }), false);
    assert.equal(registry.is(discriminatedSchema.$id, {
      'kind': 'triangle',
      'sides': 3
    }), false);
    assert.equal(registry.is(discriminatedSchema.$id, { 'radius': 5 }), false);
    assert.equal(registry.is(discriminatedSchema.$id, 'hello'), false);

    // Plain oneOf behaves identically for valid cases
    assert.equal(registry.is(plainOneOfSchema.$id, {
      'kind': 'circle',
      'radius': 5
    }), true);
    assert.equal(registry.is(plainOneOfSchema.$id, {
      'height': 20,
      'kind': 'rect',
      'width': 10
    }), true);
    assert.equal(registry.is(plainOneOfSchema.$id, { 'kind': 'circle' }), false);
  });

  void it('discriminator.mapping dispatches by mapped $ref target', () => {
    const registry = new SchemaRegistry();
    const DogSchema = {
      '$id': 'urn:test:dog',
      'properties': {
        'breed': { 'type': 'string' },
        'petType': { 'type': 'string' }
      },
      'required': [
        'petType',
        'breed'
      ],
      'type': 'object'
    };
    const CatSchema = {
      '$id': 'urn:test:cat',
      'properties': {
        'color': { 'type': 'string' },
        'petType': { 'type': 'string' }
      },
      'required': [
        'petType',
        'color'
      ],
      'type': 'object'
    };
    const PetSchema = {
      '$id': 'urn:test:pet-mapped',
      'discriminator': {
        'mapping': {
          'cat': 'urn:test:cat',
          'dog': 'urn:test:dog'
        },
        'propertyName': 'petType'
      },
      'oneOf': [
        { '$ref': 'urn:test:dog' },
        { '$ref': 'urn:test:cat' }
      ]
    };

    registry.register([
      DogSchema,
      CatSchema,
      PetSchema
    ]);
    assert.equal(registry.is(PetSchema.$id, {
      'breed': 'poodle',
      'petType': 'dog'
    }), true);
    assert.equal(registry.is(PetSchema.$id, {
      'color': 'black',
      'petType': 'cat'
    }), true);
    assert.equal(registry.is(PetSchema.$id, { 'petType': 'dog' }), false);
    assert.equal(registry.is(PetSchema.$id, {
      'fins': 2,
      'petType': 'fish'
    }), false);
  });
});
