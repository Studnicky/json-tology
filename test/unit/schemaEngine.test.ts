import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';

void describe('Graph engine advanced keywords', () => {
  void it('supports patternProperties', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:pattern-properties',
      'patternProperties': { '^x-': { 'type': 'string' } },
      'type': 'object'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'x-name': 'ok' }), true);
    assert.equal(registry.is(schema.$id, { 'x-name': 1 }), false);
  });

  void it('supports propertyNames', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:property-names',
      'propertyNames': {
        'pattern': '^[a-z]+$',
        'type': 'string'
      },
      'type': 'object'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'good': 1 }), true);
    assert.equal(registry.is(schema.$id, { 'Bad-Key': 1 }), false);
  });

  void it('supports dependentRequired', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:dependent-required',
      'dependentRequired': { 'creditCard': ['billingAddress'] },
      'type': 'object'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, {
      'billingAddress': 'x',
      'creditCard': '4111'
    }), true);
    assert.equal(registry.is(schema.$id, { 'creditCard': '4111' }), false);
  });

  void it('supports dependentSchemas', () => {
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

  void it('supports prefixItems with 2020-12 items tail constraints', () => {
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

  void it('supports contains with minContains and maxContains', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:contains-min-max',
      'contains': { 'type': 'number' },
      'maxContains': 3,
      'minContains': 2,
      'type': 'array'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [
      1,
      2,
      'x'
    ]), true);
    assert.equal(registry.is(schema.$id, [
      1,
      'x'
    ]), false);
    assert.equal(registry.is(schema.$id, [
      1,
      2,
      3,
      4
    ]), false);
  });

  void it('supports uniqueItems with semantic equality', () => {
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

  void it('supports if/then/else', () => {
    const registry = new SchemaRegistry();
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
  });

  void it('supports extended string format assertions', () => {
    const registry = new SchemaRegistry();

    const durSchema = {
      '$id': 'urn:test:fmt-duration',
      'format': 'duration',
      'type': 'string'
    } as const;
    const ipv6Schema = {
      '$id': 'urn:test:fmt-ipv6',
      'format': 'ipv6',
      'type': 'string'
    } as const;
    const uriRefSchema = {
      '$id': 'urn:test:fmt-uri-ref',
      'format': 'uri-reference',
      'type': 'string'
    } as const;
    const uriTplSchema = {
      '$id': 'urn:test:fmt-uri-tpl',
      'format': 'uri-template',
      'type': 'string'
    } as const;
    const jptrSchema = {
      '$id': 'urn:test:fmt-json-pointer',
      'format': 'json-pointer',
      'type': 'string'
    } as const;
    const regexSchema = {
      '$id': 'urn:test:fmt-regex',
      'format': 'regex',
      'type': 'string'
    } as const;
    const byteSchema = {
      '$id': 'urn:test:fmt-byte',
      'format': 'byte',
      'type': 'string'
    } as const;
    const binarySchema = {
      '$id': 'urn:test:fmt-binary',
      'format': 'binary',
      'type': 'string'
    } as const;

    registry.register([
      durSchema,
      ipv6Schema,
      uriRefSchema,
      uriTplSchema,
      jptrSchema,
      regexSchema,
      byteSchema,
      binarySchema
    ]);

    assert.equal(registry.is(durSchema.$id, 'P3DT4H'), true);
    assert.equal(registry.is(durSchema.$id, 'three days'), false);
    assert.equal(registry.is(ipv6Schema.$id, '2001:db8::1'), true);
    assert.equal(registry.is(ipv6Schema.$id, '999.1.1.1'), false);
    assert.equal(registry.is(uriRefSchema.$id, '/users/123?draft=true'), true);
    assert.equal(registry.is(uriTplSchema.$id, '/users/{id}'), true);
    assert.equal(registry.is(uriTplSchema.$id, '/users/{id'), false);
    assert.equal(registry.is(jptrSchema.$id, '/items/0/name'), true);
    assert.equal(registry.is(jptrSchema.$id, 'items/0/name'), false);
    assert.equal(registry.is(regexSchema.$id, '^[a-z]+$'), true);
    assert.equal(registry.is(regexSchema.$id, '['), false);
    assert.equal(registry.is(byteSchema.$id, 'SGVsbG8='), true);
    assert.equal(registry.is(binarySchema.$id, '0aff'), true);
    assert.equal(registry.is(binarySchema.$id, 'xyz'), false);
  });

  void it('supports numeric format assertions', () => {
    const registry = new SchemaRegistry();

    const int32Schema = {
      '$id': 'urn:test:fmt-int32',
      'format': 'int32',
      'type': 'integer'
    } as const;
    const int64Schema = {
      '$id': 'urn:test:fmt-int64',
      'format': 'int64',
      'type': 'integer'
    } as const;
    const floatSchema = {
      '$id': 'urn:test:fmt-float',
      'format': 'float',
      'type': 'number'
    } as const;

    registry.register([
      int32Schema,
      int64Schema,
      floatSchema
    ]);

    assert.equal(registry.is(int32Schema.$id, 2_147_483_647), true);
    assert.equal(registry.is(int32Schema.$id, 2_147_483_648), false);
    assert.equal(registry.is(int64Schema.$id, Number.MAX_SAFE_INTEGER), true);
    assert.equal(registry.is(int64Schema.$id, Number.MAX_SAFE_INTEGER + 1), false);
    assert.equal(registry.is(floatSchema.$id, Math.fround(1.5)), true);
    assert.equal(registry.is(floatSchema.$id, 1e40), false);
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

  void it('format as annotation vs assertion based on 2020-12 vocabulary', () => {
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
  });

  void it('treats 2020-12 content keywords as annotations rather than assertions', () => {
    const registry = new SchemaRegistry();
    const contentInnerSchema = {
      '$id': 'urn:test:content-inner',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;
    const schema = {
      '$comment': 'content metadata only',
      '$id': 'urn:test:content-annotations',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'contentEncoding': 'base64',
      'contentMediaType': 'application/json',
      'contentSchema': { '$ref': 'urn:test:content-inner' },
      'type': 'string'
    } as const;

    registry.register([
      contentInnerSchema,
      schema
    ]);
    assert.equal(registry.is(schema.$id, 'definitely not base64 or json'), true);
  });

  void it('supports unevaluatedProperties and unevaluatedItems', () => {
    const registry = new SchemaRegistry();

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
  });

  void it('tracks evaluated properties across allOf/anyOf before applying unevaluatedProperties', () => {
    const registry = new SchemaRegistry();

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
  });

  void it('tracks evaluated items across allOf before applying unevaluatedItems', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unevaluated-items-allof',
      'allOf': [{ 'prefixItems': [{ 'type': 'string' }] }],
      'type': 'array',
      'unevaluatedItems': false
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, ['hello']), true);
    assert.equal(registry.is(schema.$id, [
      'hello',
      42
    ]), false);
  });

  void it('tracks evaluated properties from conditional branches before applying unevaluatedProperties', () => {
    const registry = new SchemaRegistry();
    const schema = {
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

    registry.register(schema);
    assert.equal(registry.is(schema.$id, {
      'aValue': 1,
      'kind': 'a'
    }), true);
    assert.equal(registry.is(schema.$id, {
      'bValue': 'x',
      'kind': 'b'
    }), true);
    assert.equal(registry.is(schema.$id, {
      'aValue': 1,
      'extra': true,
      'kind': 'a'
    }), false);
  });

  void it('supports external schema refs through the registry', () => {
    const registry = new SchemaRegistry();
    const addressSchema = {
      '$id': 'https://example.io/Address',
      'properties': { 'street': { 'type': 'string' } },
      'required': ['street'],
      'type': 'object'
    } as const;
    const userSchema = {
      '$id': 'https://example.io/UserWithAddress',
      'properties': { 'address': { '$ref': 'https://example.io/Address' } },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([
      addressSchema,
      userSchema
    ]);
    assert.deepEqual(registry.validate(userSchema.$id, { 'address': { 'street': '1 Main' } }), []);
    assert.notDeepEqual(registry.validate(userSchema.$id, { 'address': {} }), []);
  });

  void it('supports local and external anchor refs', () => {
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
  });

  void it('supports local and external dynamic refs with scope override', () => {
    const registry = new SchemaRegistry();

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
    const addressSchema = {
      '$dynamicAnchor': 'addressNode',
      '$id': 'https://example.io/dynamic-address',
      'properties': { 'street': { 'type': 'string' } },
      'required': ['street'],
      'type': 'object'
    } as const;
    const userSchema = {
      '$id': 'https://example.io/dynamic-user',
      'properties': { 'address': { '$dynamicRef': 'https://example.io/dynamic-address#addressNode' } },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([
      addressSchema,
      userSchema
    ]);
    assert.deepEqual(registry.validate(userSchema.$id, { 'address': { 'street': '1 Main' } }), []);
    assert.notDeepEqual(registry.validate(userSchema.$id, { 'address': {} }), []);
  });

  void it('supports boolean schemas and Unicode code-point length', () => {
    const registry = new SchemaRegistry();

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

    const unicodeSchema = {
      '$id': 'urn:test:unicode-length',
      'maxLength': 1,
      'type': 'string'
    } as const;

    registry.register(unicodeSchema);
    assert.equal(registry.is(unicodeSchema.$id, '\u{1F600}'), true);
    assert.equal(registry.is(unicodeSchema.$id, '\u{1F600}a'), false);
  });
});

void describe('Phase 2.4 — edge case hardening', () => {
  void it('boolean schemas at composition boundaries', () => {
    const registry = new SchemaRegistry();

    const trueSchema = {
      '$id': 'urn:test:allof-true',
      'allOf': [true]
    } as const;
    const falseSchema = {
      '$id': 'urn:test:allof-false',
      'allOf': [false]
    } as const;
    const tfSchema = {
      '$id': 'urn:test:allof-true-false',
      'allOf': [
        true,
        false
      ]
    } as const;

    registry.register([
      trueSchema,
      falseSchema,
      tfSchema
    ]);

    assert.equal(registry.is(trueSchema.$id, 'hello'), true);
    assert.equal(registry.is(trueSchema.$id, 42), true);
    assert.equal(registry.is(trueSchema.$id, null), true);
    assert.equal(registry.is(falseSchema.$id, 'hello'), false);
    assert.equal(registry.is(falseSchema.$id, 42), false);
    assert.equal(registry.is(tfSchema.$id, 'hello'), false);
    assert.equal(registry.is(tfSchema.$id, null), false);
  });

  void it('contains with minContains: 0 always passes', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:contains-min-zero',
      'contains': { 'type': 'string' },
      'minContains': 0,
      'type': 'array'
    };

    registry.register(schema);
    assert.equal(registry.is(schema.$id, []), true);
    assert.equal(registry.is(schema.$id, [
      1,
      2,
      3
    ]), true);
    assert.equal(registry.is(schema.$id, [
      'a',
      'b'
    ]), true);
  });

  void it('if/then/else interaction with unevaluatedProperties', () => {
    const registry = new SchemaRegistry();
    const schema = {
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

    registry.register(schema);
    assert.equal(registry.is(schema.$id, {
      'level': 5,
      'type': 'admin'
    }), true);
    assert.equal(registry.is(schema.$id, { 'type': 'user' }), true);
    assert.equal(registry.is(schema.$id, {
      'extra': 1,
      'level': 5,
      'type': 'admin'
    }), false);
  });

  void it('propertyNames with complex schemas (minLength + maxLength)', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:property-names-complex',
      'propertyNames': {
        'maxLength': 10,
        'minLength': 3
      },
      'type': 'object'
    };

    registry.register(schema);
    assert.equal(registry.is(schema.$id, {
      'barbaz': 2,
      'foo': 1
    }), true);
    assert.equal(registry.is(schema.$id, { 'ab': 1 }), false);
    assert.equal(registry.is(schema.$id, { 'thisnameiswaytoolong': 1 }), false);
    assert.equal(registry.is(schema.$id, {}), true);
  });

  void it('nested $ref chains: A refs B which refs C', () => {
    const registry = new SchemaRegistry();
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
  });

  void it('additionalProperties: false with allOf only considers local properties', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:additional-allof',
      'additionalProperties': false,
      'allOf': [{ 'properties': { 'b': { 'type': 'number' } } }],
      'properties': { 'a': { 'type': 'string' } },
      'type': 'object'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'a': 'hello' }), true);
    assert.equal(registry.is(schema.$id, {
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

  void it('validates, rejects, and falls back correctly with discriminator', () => {
    const registry = new SchemaRegistry();

    registerAll(registry);

    // Valid variants
    assert.equal(registry.is(discriminatedSchema.$id, {
      'kind': 'circle',
      'radius': 5
    }), true);
    assert.equal(registry.is(discriminatedSchema.$id, {
      'height': 20,
      'kind': 'rect',
      'width': 10
    }), true);

    // Missing required field for variant
    assert.equal(registry.is(discriminatedSchema.$id, { 'kind': 'circle' }), false);

    // Unknown discriminator value
    assert.equal(registry.is(discriminatedSchema.$id, {
      'kind': 'triangle',
      'sides': 3
    }), false);

    // Missing discriminator property — falls back to normal oneOf
    assert.equal(registry.is(discriminatedSchema.$id, { 'radius': 5 }), false);

    // Non-object data
    assert.equal(registry.is(discriminatedSchema.$id, 'hello'), false);
    assert.equal(registry.is(discriminatedSchema.$id, 42), false);
  });

  void it('schemas without discriminator behave identically', () => {
    const registry = new SchemaRegistry();

    registerAll(registry);

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

    // Valid via mapping dispatch
    assert.equal(registry.is(PetSchema.$id, {
      'breed': 'poodle',
      'petType': 'dog'
    }), true);
    assert.equal(registry.is(PetSchema.$id, {
      'color': 'black',
      'petType': 'cat'
    }), true);

    // Missing required field
    assert.equal(registry.is(PetSchema.$id, { 'petType': 'dog' }), false);

    // Unknown mapping value — falls back to const scan, then to normal oneOf
    assert.equal(registry.is(PetSchema.$id, {
      'fins': 2,
      'petType': 'fish'
    }), false);
  });
});
