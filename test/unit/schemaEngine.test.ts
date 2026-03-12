import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';

describe('Graph engine advanced keywords', () => {
  it('supports patternProperties', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:pattern-properties',
      'type': 'object',
      'patternProperties': {
        '^x-': { 'type': 'string' }
      }
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'x-name': 'ok' }), true);
    assert.equal(registry.is(schema.$id, { 'x-name': 1 }), false);
  });

  it('supports propertyNames', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:property-names',
      'type': 'object',
      'propertyNames': {
        'pattern': '^[a-z]+$',
        'type': 'string'
      }
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'good': 1 }), true);
    assert.equal(registry.is(schema.$id, { 'Bad-Key': 1 }), false);
  });

  it('supports dependentRequired', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:dependent-required',
      'type': 'object',
      'dependentRequired': {
        'creditCard': ['billingAddress']
      }
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'creditCard': '4111', 'billingAddress': 'x' }), true);
    assert.equal(registry.is(schema.$id, { 'creditCard': '4111' }), false);
  });

  it('supports dependentSchemas', () => {
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
      'type': 'object',
      'dependentSchemas': {
        'kind': { '$ref': 'urn:test:dependent-schemas-kind-dep' }
      }
    } as const;

    registry.register([kindDepSchema, schema]);
    assert.equal(registry.is(schema.$id, { 'kind': 'business', 'taxId': '123' }), true);
    assert.equal(registry.is(schema.$id, { 'kind': 'business' }), false);
  });

  it('supports prefixItems with 2020-12 items tail constraints', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:prefix-items',
      'type': 'array',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'items': false
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, ['x', 1]), true);
    assert.equal(registry.is(schema.$id, ['x', 1, true]), false);
  });

  it('supports contains with minContains and maxContains', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:contains-min-max',
      'type': 'array',
      'contains': { 'type': 'number' },
      'minContains': 2,
      'maxContains': 3
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [1, 2, 'x']), true);
    assert.equal(registry.is(schema.$id, [1, 'x']), false);
    assert.equal(registry.is(schema.$id, [1, 2, 3, 4]), false);
  });

  it('supports uniqueItems', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unique-items',
      'type': 'array',
      'uniqueItems': true
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [1, 2, 3]), true);
    assert.equal(registry.is(schema.$id, [1, 2, 1]), false);
  });

  it('supports if/then/else', () => {
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
      'if': { '$ref': 'urn:test:ite-if' },
      'then': { '$ref': 'urn:test:ite-then' },
      'else': { '$ref': 'urn:test:ite-else' },
      'type': 'object'
    } as const;

    registry.register([ifSchema, thenSchema, elseSchema, schema]);
    assert.equal(registry.is(schema.$id, { 'kind': 'business', 'taxId': '123' }), true);
    assert.equal(registry.is(schema.$id, { 'kind': 'business' }), false);
    assert.equal(registry.is(schema.$id, { 'kind': 'person', 'ssn': '999' }), true);
    assert.equal(registry.is(schema.$id, { 'kind': 'person' }), false);
  });

  it('supports extended string format assertions', () => {
    const registry = new SchemaRegistry();

    const durSchema = { '$id': 'urn:test:fmt-duration', 'format': 'duration', 'type': 'string' } as const;
    const ipv6Schema = { '$id': 'urn:test:fmt-ipv6', 'format': 'ipv6', 'type': 'string' } as const;
    const uriRefSchema = { '$id': 'urn:test:fmt-uri-ref', 'format': 'uri-reference', 'type': 'string' } as const;
    const uriTplSchema = { '$id': 'urn:test:fmt-uri-tpl', 'format': 'uri-template', 'type': 'string' } as const;
    const jptrSchema = { '$id': 'urn:test:fmt-json-pointer', 'format': 'json-pointer', 'type': 'string' } as const;
    const regexSchema = { '$id': 'urn:test:fmt-regex', 'format': 'regex', 'type': 'string' } as const;
    const byteSchema = { '$id': 'urn:test:fmt-byte', 'format': 'byte', 'type': 'string' } as const;
    const binarySchema = { '$id': 'urn:test:fmt-binary', 'format': 'binary', 'type': 'string' } as const;

    registry.register([durSchema, ipv6Schema, uriRefSchema, uriTplSchema, jptrSchema, regexSchema, byteSchema, binarySchema]);

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

  it('supports numeric format assertions', () => {
    const registry = new SchemaRegistry();

    const int32Schema = { '$id': 'urn:test:fmt-int32', 'format': 'int32', 'type': 'integer' } as const;
    const int64Schema = { '$id': 'urn:test:fmt-int64', 'format': 'int64', 'type': 'integer' } as const;
    const floatSchema = { '$id': 'urn:test:fmt-float', 'format': 'float', 'type': 'number' } as const;

    registry.register([int32Schema, int64Schema, floatSchema]);

    assert.equal(registry.is(int32Schema.$id, 2147483647), true);
    assert.equal(registry.is(int32Schema.$id, 2147483648), false);

    assert.equal(registry.is(int64Schema.$id, Number.MAX_SAFE_INTEGER), true);
    assert.equal(registry.is(int64Schema.$id, Number.MAX_SAFE_INTEGER + 1), false);

    assert.equal(registry.is(floatSchema.$id, Math.fround(1.5)), true);
    assert.equal(registry.is(floatSchema.$id, 1e40), false);
  });

  it('rejects unsupported non-2020-12 dialect declarations', () => {
    assert.throws(() => {
      new GraphEngine({
        '$schema': 'http://json-schema.org/draft-07/schema#',
        'type': 'string'
      });
    }, /Unsupported JSON Schema dialect/);
  });

  it('rejects unknown required vocabularies in 2020-12 schemas', () => {
    assert.throws(() => {
      new GraphEngine({
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://example.io/vocab/custom-required': true
        },
        'type': 'string'
      });
    }, /Unsupported required JSON Schema vocabulary/);
  });

  it('treats format as annotation when 2020-12 format-assertion is not enabled', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:format-annotation',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'format': 'email',
      'type': 'string'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, 'not-an-email'), true);
  });

  it('asserts format when the 2020-12 format-assertion vocabulary is enabled', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:format-assertion-vocab',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/applicator': true,
        'https://json-schema.org/draft/2020-12/vocab/unevaluated': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true,
        'https://json-schema.org/draft/2020-12/vocab/meta-data': true,
        'https://json-schema.org/draft/2020-12/vocab/format-annotation': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
        'https://json-schema.org/draft/2020-12/vocab/content': true
      },
      'format': 'email',
      'type': 'string'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, 'alice@example.io'), true);
    assert.equal(registry.is(schema.$id, 'not-an-email'), false);
  });

  it('treats 2020-12 content keywords as annotations rather than assertions', () => {
    const registry = new SchemaRegistry();
    const contentInnerSchema = {
      '$id': 'urn:test:content-inner',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;
    const schema = {
      '$id': 'urn:test:content-annotations',
      '$comment': 'content metadata only',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'contentEncoding': 'base64',
      'contentMediaType': 'application/json',
      'contentSchema': { '$ref': 'urn:test:content-inner' },
      'type': 'string'
    } as const;

    registry.register([contentInnerSchema, schema]);
    assert.equal(registry.is(schema.$id, 'definitely not base64 or json'), true);
  });

  it('supports unevaluatedProperties', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unevaluated-props',
      'properties': {
        'name': { 'type': 'string' }
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'name': 'Alice' }), true);
    assert.equal(registry.is(schema.$id, { 'name': 'Alice', 'extra': true }), false);
  });

  it('supports unevaluatedItems', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unevaluated-items',
      'contains': { 'type': 'number' },
      'type': 'array',
      'unevaluatedItems': false
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [1]), true);
    assert.equal(registry.is(schema.$id, [1, 'x']), false);
  });

  it.todo('tracks evaluated properties across allOf before applying unevaluatedProperties');

  it.todo('tracks evaluated properties from a matched anyOf branch before applying unevaluatedProperties');

  it.todo('aggregates evaluated properties from all successful anyOf branches before applying unevaluatedProperties');

  it.todo('tracks evaluated items across allOf before applying unevaluatedItems');

  it.todo('tracks evaluated properties from conditional branches before applying unevaluatedProperties');

  it('supports external schema refs through the registry', () => {
    const registry = new SchemaRegistry();
    const addressSchema = {
      '$id': 'https://example.io/Address',
      'properties': {
        'street': { 'type': 'string' }
      },
      'required': ['street'],
      'type': 'object'
    } as const;
    const userSchema = {
      '$id': 'https://example.io/UserWithAddress',
      'properties': {
        'address': { '$ref': 'https://example.io/Address' }
      },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([addressSchema, userSchema]);

    assert.deepEqual(registry.validate(userSchema.$id, {
      'address': {
        'street': '1 Main'
      }
    }), []);
    assert.notDeepEqual(registry.validate(userSchema.$id, {
      'address': {}
    }), []);
  });

  it('supports local anchor refs', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:local-anchor-refs',
      '$defs': {
        'named': {
          '$anchor': 'namedAddress',
          'properties': {
            'street': { 'type': 'string' }
          },
          'required': ['street'],
          'type': 'object'
        }
      },
      'properties': {
        'address': { '$ref': '#namedAddress' }
      },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, {
      'address': { 'street': '1 Main' }
    }), true);
    assert.equal(registry.is(schema.$id, {
      'address': {}
    }), false);
  });

  it('supports external anchor refs through the registry', () => {
    const registry = new SchemaRegistry();
    const addressSchema = {
      '$anchor': 'sharedAddress',
      '$id': 'https://example.io/AddressAnchored',
      'properties': {
        'street': { 'type': 'string' }
      },
      'required': ['street'],
      'type': 'object'
    } as const;
    const userSchema = {
      '$id': 'https://example.io/UserWithAnchoredAddress',
      'properties': {
        'address': { '$ref': 'https://example.io/AddressAnchored#sharedAddress' }
      },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([addressSchema, userSchema]);

    assert.deepEqual(registry.validate(userSchema.$id, {
      'address': { 'street': '1 Main' }
    }), []);
    assert.notDeepEqual(registry.validate(userSchema.$id, {
      'address': {}
    }), []);
  });

  it('supports local dynamic refs', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:local-dynamic-refs',
      '$dynamicAnchor': 'node',
      'properties': {
        'child': { '$dynamicRef': '#node' },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, {
      'child': { 'value': 2 },
      'value': 1
    }), true);
    assert.equal(registry.is(schema.$id, {
      'child': {},
      'value': 1
    }), false);
  });

  it('supports dynamic scope override for recursive refs', () => {
    const registry = new SchemaRegistry();
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
      'properties': {
        'tag': { 'type': 'string' }
      },
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

    registry.register([treeSchema, tagMixinSchema, strictTreeSchema]);

    assert.deepEqual(registry.validate(strictTreeSchema.$id, {
      'children': [
        {
          'tag': 'child',
          'value': 2
        }
      ],
      'tag': 'root',
      'value': 1
    }), []);
    assert.notDeepEqual(registry.validate(strictTreeSchema.$id, {
      'children': [
        {
          'value': 2
        }
      ],
      'tag': 'root',
      'value': 1
    }), []);
  });

  it('supports external dynamic refs through the registry', () => {
    const registry = new SchemaRegistry();
    const addressSchema = {
      '$dynamicAnchor': 'addressNode',
      '$id': 'https://example.io/dynamic-address',
      'properties': {
        'street': { 'type': 'string' }
      },
      'required': ['street'],
      'type': 'object'
    } as const;
    const userSchema = {
      '$id': 'https://example.io/dynamic-user',
      'properties': {
        'address': { '$dynamicRef': 'https://example.io/dynamic-address#addressNode' }
      },
      'required': ['address'],
      'type': 'object'
    } as const;

    registry.register([addressSchema, userSchema]);

    assert.deepEqual(registry.validate(userSchema.$id, {
      'address': { 'street': '1 Main' }
    }), []);
    assert.notDeepEqual(registry.validate(userSchema.$id, {
      'address': {}
    }), []);
  });

  it('supports boolean schemas in the registry', () => {
    const registry = new SchemaRegistry();
    const trueSchema = { '$id': 'urn:test:bool-true' } as const;
    const falseSchema = { '$id': 'urn:test:bool-false', 'not': {} } as const;

    registry.register([trueSchema, falseSchema]);
    assert.equal(registry.is(trueSchema.$id, { 'anything': true }), true);
    assert.equal(registry.is(falseSchema.$id, { 'anything': true }), false);
  });

  it('counts Unicode code points for string length keywords', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unicode-length',
      'maxLength': 1,
      'type': 'string'
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, '😀'), true);
    assert.equal(registry.is(schema.$id, '😀a'), false);
  });

  it('compares array items using semantic equality for uniqueItems', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:unique-items-semantic',
      'type': 'array',
      'uniqueItems': true
    } as const;

    registry.register(schema);
    assert.equal(registry.is(schema.$id, [{ 'a': 1, 'b': 2 }, { 'b': 2, 'a': 1 }]), false);
  });
});

describe('Phase 2.4 — edge case hardening', () => {
  it('boolean schemas at composition boundaries: allOf [true] passes anything', () => {
    const registry = new SchemaRegistry();
    const schema = { '$id': 'urn:test:allof-true', 'allOf': [true] } as const;
    registry.register(schema);
    assert.equal(registry.is(schema.$id, 'hello'), true);
    assert.equal(registry.is(schema.$id, 42), true);
    assert.equal(registry.is(schema.$id, null), true);
  });

  it('boolean schemas at composition boundaries: allOf [false] rejects everything', () => {
    const registry = new SchemaRegistry();
    const schema = { '$id': 'urn:test:allof-false', 'allOf': [false] } as const;
    registry.register(schema);
    assert.equal(registry.is(schema.$id, 'hello'), false);
    assert.equal(registry.is(schema.$id, 42), false);
  });

  it('boolean schemas at composition boundaries: allOf [true, false] rejects everything', () => {
    const registry = new SchemaRegistry();
    const schema = { '$id': 'urn:test:allof-true-false', 'allOf': [true, false] } as const;
    registry.register(schema);
    assert.equal(registry.is(schema.$id, 'hello'), false);
    assert.equal(registry.is(schema.$id, 42), false);
    assert.equal(registry.is(schema.$id, null), false);
  });

  it('contains with minContains: 0 always passes', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:contains-min-zero',
      'type': 'array',
      'contains': { 'type': 'string' },
      'minContains': 0
    };

    registry.register(schema);
    assert.equal(registry.is(schema.$id, []), true);
    assert.equal(registry.is(schema.$id, [1, 2, 3]), true);
    assert.equal(registry.is(schema.$id, ['a', 'b']), true);
  });

  it.todo('if/then/else interaction with unevaluatedProperties: then-branch properties count as evaluated');

  it('propertyNames with complex schemas (minLength + maxLength)', () => {
    const registry = new SchemaRegistry();
    const schema = {
      '$id': 'urn:test:property-names-complex',
      'type': 'object',
      'propertyNames': { 'minLength': 3, 'maxLength': 10 }
    };

    registry.register(schema);
    assert.equal(registry.is(schema.$id, { 'foo': 1, 'barbaz': 2 }), true);
    assert.equal(registry.is(schema.$id, { 'ab': 1 }), false);
    assert.equal(registry.is(schema.$id, { 'thisnameiswaytoolong': 1 }), false);
    assert.equal(registry.is(schema.$id, {}), true);
  });

  it('nested $ref chains: A refs B which refs C', () => {
    const registry = new SchemaRegistry();
    const schemaC = {
      '$id': 'https://example.io/C',
      'type': 'object',
      'properties': { 'value': { 'type': 'number' } },
      'required': ['value']
    };
    const schemaB = {
      '$id': 'https://example.io/B',
      'type': 'object',
      'properties': { 'nested': { '$ref': 'https://example.io/C' } },
      'required': ['nested']
    };
    const schemaA = {
      '$id': 'https://example.io/A',
      'type': 'object',
      'properties': { 'inner': { '$ref': 'https://example.io/B' } },
      'required': ['inner']
    };

    registry.register([schemaC, schemaB, schemaA]);

    assert.deepEqual(registry.validate('https://example.io/A', {
      'inner': { 'nested': { 'value': 42 } }
    }), []);
    assert.notDeepEqual(registry.validate('https://example.io/A', {
      'inner': { 'nested': { 'value': 'not a number' } }
    }), []);
    assert.notDeepEqual(registry.validate('https://example.io/A', {
      'inner': {}
    }), []);
  });

  it.todo('additionalProperties: false with allOf only considers local properties');
});

describe('Discriminator-based oneOf optimization', () => {
  const CircleSchema = {
    '$id': 'urn:test:circle',
    'type': 'object',
    'properties': {
      'kind': { 'type': 'string', 'const': 'circle' },
      'radius': { 'type': 'number' }
    },
    'required': ['kind', 'radius']
  } as const;

  const RectSchema = {
    '$id': 'urn:test:rect',
    'type': 'object',
    'properties': {
      'kind': { 'type': 'string', 'const': 'rect' },
      'width': { 'type': 'number' },
      'height': { 'type': 'number' }
    },
    'required': ['kind', 'width', 'height']
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
    registry.register([CircleSchema, RectSchema, discriminatedSchema, plainOneOfSchema]);
  }

  it('validates matching discriminator variant (circle)', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    assert.equal(registry.is(discriminatedSchema.$id, { 'kind': 'circle', 'radius': 5 }), true);
  });

  it('validates matching discriminator variant (rect)', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    assert.equal(registry.is(discriminatedSchema.$id, { 'kind': 'rect', 'width': 10, 'height': 20 }), true);
  });

  it('rejects data that does not match the discriminated variant', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    // kind=circle but missing radius
    assert.equal(registry.is(discriminatedSchema.$id, { 'kind': 'circle' }), false);
  });

  it('rejects data with unknown discriminator value', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    assert.equal(registry.is(discriminatedSchema.$id, { 'kind': 'triangle', 'sides': 3 }), false);
  });

  it('falls back to normal oneOf when discriminator property is missing from data', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    // No 'kind' property — should fall back to iterating all variants
    assert.equal(registry.is(discriminatedSchema.$id, { 'radius': 5 }), false);
  });

  it('schemas without discriminator behave identically', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    assert.equal(registry.is(plainOneOfSchema.$id, { 'kind': 'circle', 'radius': 5 }), true);
    assert.equal(registry.is(plainOneOfSchema.$id, { 'kind': 'rect', 'width': 10, 'height': 20 }), true);
    assert.equal(registry.is(plainOneOfSchema.$id, { 'kind': 'circle' }), false);
  });

  it('works with non-object data (falls back to normal oneOf)', () => {
    const registry = new SchemaRegistry();
    registerAll(registry);

    assert.equal(registry.is(discriminatedSchema.$id, 'hello'), false);
    assert.equal(registry.is(discriminatedSchema.$id, 42), false);
  });
});
