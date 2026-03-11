import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';
import { GraphEngine } from '../../src/schema/GraphEngine.js';
import { Validator } from '../../src/schema/Validator.js';

describe('Graph engine advanced keywords', () => {
  it('supports patternProperties', () => {
    const validator = new Validator();
    const schema = {
      'type': 'object',
      'patternProperties': {
        '^x-': { 'type': 'string' }
      }
    } as const;

    assert.equal(validator.isValid(schema, { 'x-name': 'ok' }), true);
    assert.equal(validator.isValid(schema, { 'x-name': 1 }), false);
  });

  it('supports propertyNames', () => {
    const validator = new Validator();
    const schema = {
      'type': 'object',
      'propertyNames': {
        'pattern': '^[a-z]+$',
        'type': 'string'
      }
    } as const;

    assert.equal(validator.isValid(schema, { 'good': 1 }), true);
    assert.equal(validator.isValid(schema, { 'Bad-Key': 1 }), false);
  });

  it('supports dependentRequired', () => {
    const validator = new Validator();
    const schema = {
      'type': 'object',
      'dependentRequired': {
        'creditCard': ['billingAddress']
      }
    } as const;

    assert.equal(validator.isValid(schema, { 'creditCard': '4111', 'billingAddress': 'x' }), true);
    assert.equal(validator.isValid(schema, { 'creditCard': '4111' }), false);
  });

  it('supports dependentSchemas', () => {
    const validator = new Validator();
    const schema = {
      'type': 'object',
      'dependentSchemas': {
        'kind': {
          'properties': {
            'kind': { 'const': 'business' },
            'taxId': { 'type': 'string' }
          },
          'required': ['taxId'],
          'type': 'object'
        }
      }
    } as const;

    assert.equal(validator.isValid(schema, { 'kind': 'business', 'taxId': '123' }), true);
    assert.equal(validator.isValid(schema, { 'kind': 'business' }), false);
  });

  it('supports prefixItems with 2020-12 items tail constraints', () => {
    const validator = new Validator();
    const schema = {
      'type': 'array',
      'prefixItems': [
        { 'type': 'string' },
        { 'type': 'number' }
      ],
      'items': false
    } as const;

    assert.equal(validator.isValid(schema, ['x', 1]), true);
    assert.equal(validator.isValid(schema, ['x', 1, true]), false);
  });

  it('supports contains with minContains and maxContains', () => {
    const validator = new Validator();
    const schema = {
      'type': 'array',
      'contains': { 'type': 'number' },
      'minContains': 2,
      'maxContains': 3
    } as const;

    assert.equal(validator.isValid(schema, [1, 2, 'x']), true);
    assert.equal(validator.isValid(schema, [1, 'x']), false);
    assert.equal(validator.isValid(schema, [1, 2, 3, 4]), false);
  });

  it('supports uniqueItems', () => {
    const validator = new Validator();
    const schema = {
      'type': 'array',
      'uniqueItems': true
    } as const;

    assert.equal(validator.isValid(schema, [1, 2, 3]), true);
    assert.equal(validator.isValid(schema, [1, 2, 1]), false);
  });

  it('supports if/then/else', () => {
    const validator = new Validator();
    const schema = {
      'if': {
        'properties': {
          'kind': { 'const': 'business' }
        },
        'type': 'object'
      },
      'then': {
        'properties': {
          'taxId': { 'type': 'string' }
        },
        'required': ['taxId'],
        'type': 'object'
      },
      'else': {
        'properties': {
          'ssn': { 'type': 'string' }
        },
        'required': ['ssn'],
        'type': 'object'
      },
      'type': 'object'
    } as const;

    assert.equal(validator.isValid(schema, { 'kind': 'business', 'taxId': '123' }), true);
    assert.equal(validator.isValid(schema, { 'kind': 'business' }), false);
    assert.equal(validator.isValid(schema, { 'kind': 'person', 'ssn': '999' }), true);
    assert.equal(validator.isValid(schema, { 'kind': 'person' }), false);
  });

  it('supports extended string format assertions', () => {
    const validator = new Validator();

    assert.equal(validator.isValid({ 'format': 'duration', 'type': 'string' }, 'P3DT4H'), true);
    assert.equal(validator.isValid({ 'format': 'duration', 'type': 'string' }, 'three days'), false);

    assert.equal(validator.isValid({ 'format': 'ipv6', 'type': 'string' }, '2001:db8::1'), true);
    assert.equal(validator.isValid({ 'format': 'ipv6', 'type': 'string' }, '999.1.1.1'), false);

    assert.equal(validator.isValid({ 'format': 'uri-reference', 'type': 'string' }, '/users/123?draft=true'), true);
    assert.equal(validator.isValid({ 'format': 'uri-template', 'type': 'string' }, '/users/{id}'), true);
    assert.equal(validator.isValid({ 'format': 'uri-template', 'type': 'string' }, '/users/{id'), false);

    assert.equal(validator.isValid({ 'format': 'json-pointer', 'type': 'string' }, '/items/0/name'), true);
    assert.equal(validator.isValid({ 'format': 'json-pointer', 'type': 'string' }, 'items/0/name'), false);

    assert.equal(validator.isValid({ 'format': 'regex', 'type': 'string' }, '^[a-z]+$'), true);
    assert.equal(validator.isValid({ 'format': 'regex', 'type': 'string' }, '['), false);

    assert.equal(validator.isValid({ 'format': 'byte', 'type': 'string' }, 'SGVsbG8='), true);
    assert.equal(validator.isValid({ 'format': 'binary', 'type': 'string' }, '0aff'), true);
    assert.equal(validator.isValid({ 'format': 'binary', 'type': 'string' }, 'xyz'), false);
  });

  it('supports numeric format assertions', () => {
    const validator = new Validator();

    assert.equal(validator.isValid({ 'format': 'int32', 'type': 'integer' }, 2147483647), true);
    assert.equal(validator.isValid({ 'format': 'int32', 'type': 'integer' }, 2147483648), false);

    assert.equal(validator.isValid({ 'format': 'int64', 'type': 'integer' }, Number.MAX_SAFE_INTEGER), true);
    assert.equal(validator.isValid({ 'format': 'int64', 'type': 'integer' }, Number.MAX_SAFE_INTEGER + 1), false);

    assert.equal(validator.isValid({ 'format': 'float', 'type': 'number' }, Math.fround(1.5)), true);
    assert.equal(validator.isValid({ 'format': 'float', 'type': 'number' }, 1e40), false);
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
    const validator = new Validator();
    const schema = {
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'format': 'email',
      'type': 'string'
    } as const;

    assert.equal(validator.isValid(schema, 'not-an-email'), true);
  });

  it('asserts format when the 2020-12 format-assertion vocabulary is enabled', () => {
    const validator = new Validator();
    const schema = {
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

    assert.equal(validator.isValid(schema, 'alice@example.io'), true);
    assert.equal(validator.isValid(schema, 'not-an-email'), false);
  });

  it('treats 2020-12 content keywords as annotations rather than assertions', () => {
    const validator = new Validator();
    const schema = {
      '$comment': 'content metadata only',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'contentEncoding': 'base64',
      'contentMediaType': 'application/json',
      'contentSchema': {
        'properties': {
          'name': { 'type': 'string' }
        },
        'required': ['name'],
        'type': 'object'
      },
      'type': 'string'
    } as const;

    assert.equal(validator.isValid(schema, 'definitely not base64 or json'), true);
  });

  it('supports unevaluatedProperties', () => {
    const validator = new Validator();
    const schema = {
      'properties': {
        'name': { 'type': 'string' }
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    assert.equal(validator.isValid(schema, { 'name': 'Alice' }), true);
    assert.equal(validator.isValid(schema, { 'name': 'Alice', 'extra': true }), false);
  });

  it('supports unevaluatedItems', () => {
    const validator = new Validator();
    const schema = {
      'contains': { 'type': 'number' },
      'type': 'array',
      'unevaluatedItems': false
    } as const;

    assert.equal(validator.isValid(schema, [1]), true);
    assert.equal(validator.isValid(schema, [1, 'x']), false);
  });

  it('tracks evaluated properties across allOf before applying unevaluatedProperties', () => {
    const validator = new Validator();
    const schema = {
      'allOf': [
        {
          'properties': {
            'name': { 'type': 'string' }
          },
          'type': 'object'
        },
        {
          'properties': {
            'age': { 'type': 'number' }
          },
          'type': 'object'
        }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    assert.equal(validator.isValid(schema, { 'age': 42, 'name': 'Alice' }), true);
    assert.equal(validator.isValid(schema, { 'age': 42, 'extra': true, 'name': 'Alice' }), false);
  });

  it('tracks evaluated properties from a matched anyOf branch before applying unevaluatedProperties', () => {
    const validator = new Validator();
    const schema = {
      'anyOf': [
        {
          'properties': {
            'kind': { 'const': 'person' },
            'name': { 'type': 'string' }
          },
          'required': ['kind', 'name'],
          'type': 'object'
        },
        {
          'properties': {
            'company': { 'type': 'string' },
            'kind': { 'const': 'org' }
          },
          'required': ['company', 'kind'],
          'type': 'object'
        }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    assert.equal(validator.isValid(schema, { 'kind': 'person', 'name': 'Alice' }), true);
    assert.equal(validator.isValid(schema, { 'kind': 'person', 'name': 'Alice', 'role': 'admin' }), false);
  });

  it('aggregates evaluated properties from all successful anyOf branches before applying unevaluatedProperties', () => {
    const validator = new Validator();
    const schema = {
      'anyOf': [
        {
          'properties': {
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        },
        {
          'properties': {
            'role': { 'type': 'string' }
          },
          'required': ['role'],
          'type': 'object'
        }
      ],
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    assert.equal(validator.isValid(schema, { 'name': 'Alice', 'role': 'admin' }), true);
    assert.equal(validator.isValid(schema, { 'name': 'Alice', 'role': 'admin', 'team': 'ops' }), false);
  });

  it('tracks evaluated items across allOf before applying unevaluatedItems', () => {
    const validator = new Validator();
    const schema = {
      'allOf': [
        {
          'prefixItems': [
            { 'type': 'string' }
          ],
          'type': 'array'
        },
        {
          'contains': { 'type': 'number' },
          'type': 'array'
        }
      ],
      'type': 'array',
      'unevaluatedItems': false
    } as const;

    assert.equal(validator.isValid(schema, ['x', 1]), true);
    assert.equal(validator.isValid(schema, ['x', 1, true]), false);
  });

  it('tracks evaluated properties from conditional branches before applying unevaluatedProperties', () => {
    const validator = new Validator();
    const schema = {
      'if': {
        'properties': {
          'kind': { 'const': 'business' }
        },
        'type': 'object'
      },
      'then': {
        'properties': {
          'taxId': { 'type': 'string' }
        },
        'required': ['taxId'],
        'type': 'object'
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;

    assert.equal(validator.isValid(schema, { 'kind': 'business', 'taxId': '123' }), false);
    assert.equal(validator.isValid(schema, { 'kind': 'business', 'extra': true, 'taxId': '123' }), false);
  });

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
    const validator = new Validator();
    const schema = {
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

    assert.equal(validator.isValid(schema, {
      'address': { 'street': '1 Main' }
    }), true);
    assert.equal(validator.isValid(schema, {
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
    const validator = new Validator();
    const schema = {
      '$dynamicAnchor': 'node',
      'properties': {
        'child': { '$dynamicRef': '#node' },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    } as const;

    assert.equal(validator.isValid(schema, {
      'child': { 'value': 2 },
      'value': 1
    }), true);
    assert.equal(validator.isValid(schema, {
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
    const strictTreeSchema = {
      '$dynamicAnchor': 'node',
      '$id': 'https://example.io/strict-tree',
      'allOf': [
        { '$ref': 'https://example.io/tree' },
        {
          'properties': {
            'tag': { 'type': 'string' }
          },
          'required': ['tag'],
          'type': 'object'
        }
      ],
      'type': 'object'
    } as const;

    registry.register([treeSchema, strictTreeSchema]);

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

  it('supports boolean schemas in the stateless validator', () => {
    const validator = new Validator();

    assert.equal(validator.isValid(true, { 'anything': true }), true);
    assert.equal(validator.isValid(false, { 'anything': true }), false);
  });

  it('counts Unicode code points for string length keywords', () => {
    const validator = new Validator();
    const schema = {
      'maxLength': 1,
      'type': 'string'
    } as const;

    assert.equal(validator.isValid(schema, '😀'), true);
    assert.equal(validator.isValid(schema, '😀a'), false);
  });

  it('compares array items using semantic equality for uniqueItems', () => {
    const validator = new Validator();
    const schema = {
      'type': 'array',
      'uniqueItems': true
    } as const;

    assert.equal(validator.isValid(schema, [{ 'a': 1, 'b': 2 }, { 'b': 2, 'a': 1 }]), false);
  });
});
