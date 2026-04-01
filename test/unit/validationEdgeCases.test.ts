/**
 * Validation Edge Cases
 *
 * Tests for boundary conditions, degenerate inputs, and error handling
 * across registration, validation, coercion, and serialization.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { CoercionError } from '../../src/errors/CoercionError.js';
import { JsonTology } from '../../src/JsonTology.js';

// ---------------------------------------------------------------------------
// Schema registration edge cases
// ---------------------------------------------------------------------------

void describe('Registration edge cases', () => {
  void it('rejects schema with empty string $id', () => {
    const registry = new SchemaRegistry();

    assert.throws(
      () => {
        registry.register({
          '$id': '',
          'properties': { 'x': { 'type': 'string' } },
          'type': 'object'
        });
      },
      'empty string $id should throw'
    );
  });

  void it('accepts minimal and $defs-only schemas', () => {
    const scenarios: Array<{ 'data': Record<string, unknown>;
      'expected': string[];
      'name': string;
      'schema': Record<string, unknown> }> = [
      {
        'data': {},
        'expected': [],
        'name': 'schema with only $id and type validates empty object',
        'schema': {
          '$id': 'https://edge.test/EmptyObj',
          'type': 'object'
        }
      },
      {
        'data': { 'anything': true },
        'expected': [],
        'name': 'schema with only $id and type allows extra properties',
        'schema': {
          '$id': 'https://edge.test/EmptyObj2',
          'type': 'object'
        }
      },
      {
        'data': {},
        'expected': [],
        'name': 'schema with $defs but no properties validates empty object',
        'schema': {
          '$defs': {
            'Inner': {
              'properties': { 'x': { 'type': 'number' } },
              'type': 'object'
            }
          },
          '$id': 'https://edge.test/DefsOnly',
          'type': 'object'
        }
      }
    ];

    for (const {
      data, expected, name, schema
    } of scenarios) {
      const registry = new SchemaRegistry();

      registry.register(schema);
      assert.deepEqual(registry.validate(schema.$id as string, data), expected, name);
    }
  });

  void it('handles registerAnonymous and validates against synthetic ID', () => {
    const registry = new SchemaRegistry();
    const syntheticId = registry.registerAnonymous({
      'properties': { 'value': { 'type': 'number' } },
      'required': ['value'],
      'type': 'object'
    });

    assert.ok(syntheticId.startsWith('urn:json-tology:'), 'synthetic ID has expected prefix');
    assert.deepEqual(registry.validate(syntheticId, { 'value': 42 }), [], 'valid data passes');
    assert.ok(registry.validate(syntheticId, { 'value': 'not-a-number' }).length > 0, 'invalid data fails');
  });
});

// ---------------------------------------------------------------------------
// Numeric boundary scenarios
// ---------------------------------------------------------------------------

void describe('Numeric boundary validation', () => {
  void it('validates minimum/maximum at exact boundaries', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/NumBounds',
      'properties': {
        'score': {
          'maximum': 100,
          'minimum': 0,
          'type': 'number'
        }
      },
      'required': ['score'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'score': 0 },
        'name': 'minimum boundary (0) passes',
        'valid': true
      },
      {
        'data': { 'score': 100 },
        'name': 'maximum boundary (100) passes',
        'valid': true
      },
      {
        'data': { 'score': -1 },
        'name': 'below minimum (-1) fails',
        'valid': false
      },
      {
        'data': { 'score': 101 },
        'name': 'above maximum (101) fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/NumBounds', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });

  void it('validates exclusiveMinimum and exclusiveMaximum', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/ExclBounds',
      'properties': {
        'val': {
          'exclusiveMaximum': 10,
          'exclusiveMinimum': 0,
          'type': 'number'
        }
      },
      'required': ['val'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'val': 5 },
        'name': 'middle value (5) passes',
        'valid': true
      },
      {
        'data': { 'val': 0 },
        'name': 'exclusive minimum boundary (0) fails',
        'valid': false
      },
      {
        'data': { 'val': 10 },
        'name': 'exclusive maximum boundary (10) fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/ExclBounds', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });

  void it('validates multipleOf with integers', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/MultOf',
      'properties': {
        'count': {
          'multipleOf': 3,
          'type': 'integer'
        }
      },
      'required': ['count'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'count': 0 },
        'name': 'zero is multipleOf 3',
        'valid': true
      },
      {
        'data': { 'count': 9 },
        'name': '9 is multipleOf 3',
        'valid': true
      },
      {
        'data': { 'count': 7 },
        'name': '7 is not multipleOf 3',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/MultOf', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// String constraint scenarios
// ---------------------------------------------------------------------------

void describe('String constraint validation', () => {
  void it('validates string length constraints at boundaries', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/StrLen',
      'properties': {
        'code': {
          'maxLength': 5,
          'minLength': 2,
          'type': 'string'
        }
      },
      'required': ['code'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'code': 'ab' },
        'name': 'minLength boundary (2 chars) passes',
        'valid': true
      },
      {
        'data': { 'code': 'abcde' },
        'name': 'maxLength boundary (5 chars) passes',
        'valid': true
      },
      {
        'data': { 'code': 'a' },
        'name': 'below minLength (1 char) fails',
        'valid': false
      },
      {
        'data': { 'code': 'abcdef' },
        'name': 'above maxLength (6 chars) fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/StrLen', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });

  void it('validates pattern constraint', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/Pattern',
      'properties': {
        'zip': {
          'pattern': '^\\d{5}$',
          'type': 'string'
        }
      },
      'required': ['zip'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'zip': '12345' },
        'name': 'valid 5-digit zip passes',
        'valid': true
      },
      {
        'data': { 'zip': '1234' },
        'name': '4-digit zip fails',
        'valid': false
      },
      {
        'data': { 'zip': '123456' },
        'name': '6-digit zip fails',
        'valid': false
      },
      {
        'data': { 'zip': 'abcde' },
        'name': 'alpha zip fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/Pattern', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Array constraint scenarios
// ---------------------------------------------------------------------------

void describe('Array constraint validation', () => {
  void it('validates array item constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/ArrayItems',
      'properties': {
        'tags': {
          'items': { 'type': 'string' },
          'maxItems': 3,
          'minItems': 1,
          'type': 'array'
        }
      },
      'required': ['tags'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'tags': ['a'] },
        'name': 'minItems boundary (1 item) passes',
        'valid': true
      },
      {
        'data': {
          'tags': [
            'a',
            'b',
            'c'
          ]
        },
        'name': 'maxItems boundary (3 items) passes',
        'valid': true
      },
      {
        'data': { 'tags': [] },
        'name': 'empty array (below minItems) fails',
        'valid': false
      },
      {
        'data': {
          'tags': [
            'a',
            'b',
            'c',
            'd'
          ]
        },
        'name': 'above maxItems (4 items) fails',
        'valid': false
      },
      {
        'data': { 'tags': [1] },
        'name': 'wrong item type (number) fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/ArrayItems', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Enum/const scenarios
// ---------------------------------------------------------------------------

void describe('Enum and const validation', () => {
  void it('validates enum constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/Enum',
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
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'status': 'active' },
        'name': 'valid enum value passes',
        'valid': true
      },
      {
        'data': { 'status': 'unknown' },
        'name': 'invalid enum value fails',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/Enum', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });

  void it('validates const constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/Const',
      'properties': {
        'version': {
          'const': 2,
          'type': 'number'
        }
      },
      'required': ['version'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': Record<string, unknown>;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'version': 2 },
        'name': 'exact const value passes',
        'valid': true
      },
      {
        'data': { 'version': 1 },
        'name': 'different number fails',
        'valid': false
      },
      {
        'data': { 'version': '2' },
        'name': 'string "2" fails (wrong type)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/Const', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Validation boundary -- wrong top-level type
// ---------------------------------------------------------------------------

void describe('Top-level type validation', () => {
  void it('validates empty object and rejects wrong top-level types', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/NoReq',
      'properties': {
        'a': { 'type': 'string' },
        'b': { 'type': 'number' }
      },
      'type': 'object'
    });

    registry.register({
      '$id': 'https://edge.test/ObjOnly',
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schemaId': string;
      'valid': boolean }> = [
      {
        'data': {},
        'name': 'empty object against schema with no required fields',
        'schemaId': 'https://edge.test/NoReq',
        'valid': true
      },
      {
        'data': 'a string',
        'name': 'string rejected for object schema',
        'schemaId': 'https://edge.test/ObjOnly',
        'valid': false
      },
      {
        'data': 42,
        'name': 'number rejected for object schema',
        'schemaId': 'https://edge.test/ObjOnly',
        'valid': false
      },
      {
        'data': null,
        'name': 'null rejected for object schema',
        'schemaId': 'https://edge.test/ObjOnly',
        'valid': false
      },
      {
        'data': [],
        'name': 'array rejected for object schema',
        'schemaId': 'https://edge.test/ObjOnly',
        'valid': false
      }
    ];

    for (const {
      data, name, schemaId, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Coercion edge cases
// ---------------------------------------------------------------------------

void describe('Coercion edge cases', () => {
  void it('coerce applies nested defaults', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$defs': {
        'Settings': {
          'properties': {
            'theme': {
              'default': 'light',
              'type': 'string'
            },
            'volume': {
              'default': 50,
              'type': 'number'
            }
          },
          'type': 'object'
        }
      },
      '$id': 'https://edge.test/WithDefaults',
      'properties': {
        'name': { 'type': 'string' },
        'settings': { '$ref': '#/$defs/Settings' }
      },
      'required': ['name'],
      'type': 'object'
    });

    const result = registry.coerce('https://edge.test/WithDefaults', {
      'name': 'Alice',
      'settings': {}
    }) as Record<string, Record<string, unknown>>;

    const scenarios: Array<{ 'expected': unknown;
      'name': string;
      'value': unknown }> = [
      {
        'expected': 'Alice',
        'name': 'name preserved',
        'value': result.name
      },
      {
        'expected': 'light',
        'name': 'theme default applied',
        'value': result.settings.theme
      },
      {
        'expected': 50,
        'name': 'volume default applied',
        'value': result.settings.volume
      }
    ];

    for (const {
      expected, name, value
    } of scenarios) {
      assert.equal(value, expected, name);
    }
  });

  void it('coerce does not mutate the input object', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://edge.test/NoMutate',
      'properties': {
        'role': {
          'default': 'user',
          'type': 'string'
        }
      },
      'type': 'object'
    });

    const input = {};

    registry.coerce('https://edge.test/NoMutate', input);
    assert.equal(Object.keys(input).length, 0, 'input object not mutated');
  });

  void it('coerce throws CoercionError with path info on nested failure', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$defs': {
        'Address': {
          'properties': {
            'city': { 'type': 'string' },
            'zip': {
              'pattern': '^\\d{5}$',
              'type': 'string'
            }
          },
          'required': [
            'city',
            'zip'
          ],
          'type': 'object'
        }
      },
      '$id': 'https://edge.test/NestedErr',
      'properties': {
        'address': { '$ref': '#/$defs/Address' },
        'name': { 'type': 'string' }
      },
      'required': [
        'name',
        'address'
      ],
      'type': 'object'
    });

    try {
      registry.coerce('https://edge.test/NestedErr', {
        'address': {
          'city': 'Springfield',
          'zip': 'bad'
        },
        'name': 'Alice'
      });
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof CoercionError, 'nested failure: instanceof CoercionError');
      assert.ok(error.errors.length > 0, 'nested failure: has errors');
    }
  });

  void it('castTypes coerces string number to number', () => {
    const registry = new SchemaRegistry({ 'castTypes': true });

    registry.register({
      '$id': 'https://edge.test/CastNum',
      'properties': {
        'age': { 'type': 'number' },
        'name': { 'type': 'string' }
      },
      'required': [
        'name',
        'age'
      ],
      'type': 'object'
    });

    const result = registry.coerce('https://edge.test/CastNum', {
      'age': '25',
      'name': 'Alice'
    }) as Record<string, unknown>;

    assert.equal(result.age, 25, 'string "25" coerced to number 25');
    assert.equal(typeof result.age, 'number', 'coerced value is typeof number');
  });
});

// ---------------------------------------------------------------------------
// Cross-schema $ref validation
// ---------------------------------------------------------------------------

void describe('Cross-schema $ref validation', () => {
  void it('validates data against cross-schema refs', () => {
    const registry = new SchemaRegistry();

    registry.register([
      {
        '$id': 'https://edge.test/Country',
        'properties': {
          'code': {
            'maxLength': 2,
            'minLength': 2,
            'type': 'string'
          },
          'name': { 'type': 'string' }
        },
        'required': [
          'code',
          'name'
        ],
        'type': 'object'
      },
      {
        '$id': 'https://edge.test/City',
        'properties': {
          'country': { '$ref': 'https://edge.test/Country' },
          'name': { 'type': 'string' }
        },
        'required': [
          'name',
          'country'
        ],
        'type': 'object'
      }
    ]);

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'country': {
            'code': 'US',
            'name': 'United States'
          },
          'name': 'Springfield'
        },
        'name': 'valid City with valid Country ref',
        'valid': true
      },
      {
        'data': {
          'country': {
            'code': 'USA',
            'name': 'United States'
          },
          'name': 'Springfield'
        },
        'name': 'invalid country code (too long)',
        'valid': false
      },
      {
        'data': { 'name': 'Springfield' },
        'name': 'missing required country ref',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/City', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });

  void it('validates deeply chained refs (A -> B -> C)', () => {
    const registry = new SchemaRegistry();

    registry.register([
      {
        '$id': 'https://edge.test/C',
        'properties': { 'value': { 'type': 'number' } },
        'required': ['value'],
        'type': 'object'
      },
      {
        '$id': 'https://edge.test/B',
        'properties': { 'c': { '$ref': 'https://edge.test/C' } },
        'required': ['c'],
        'type': 'object'
      },
      {
        '$id': 'https://edge.test/A',
        'properties': { 'b': { '$ref': 'https://edge.test/B' } },
        'required': ['b'],
        'type': 'object'
      }
    ]);

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'b': { 'c': { 'value': 42 } } },
        'name': 'valid deeply chained ref data',
        'valid': true
      },
      {
        'data': { 'b': { 'c': { 'value': 'not-a-number' } } },
        'name': 'invalid at deepest level (string instead of number)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://edge.test/A', data);

      if (valid) {
        assert.deepEqual(errors, [], name);
      } else {
        assert.ok(errors.length > 0, name);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Serialization edge cases
// ---------------------------------------------------------------------------

void describe('Serialization edge cases', () => {
  void it('serializes schema with no properties to valid OWL class', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://edge.test',
      'schemas': [{
        '$id': 'https://edge.test/Marker',
        'type': 'object'
      }] as const
    });

    const owl = jt.ontology().jsonLdObject();

    assert.ok(owl['@graph'] !== undefined, 'OWL output has @graph');
    const graph = owl['@graph'] as Array<Record<string, unknown>>;
    const markerClass = graph.find((node) => {
      return node['@id'] === 'https://edge.test/Marker';
    });

    assert.ok(markerClass !== undefined, 'Marker class present in OWL graph');
  });

  void it('serializes schema with all scalar types', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://edge.test',
      'schemas': [{
        '$id': 'https://edge.test/AllScalars',
        'properties': {
          'active': { 'type': 'boolean' },
          'count': { 'type': 'integer' },
          'name': { 'type': 'string' },
          'score': { 'type': 'number' }
        },
        'type': 'object'
      }] as const
    });

    const shacl = jt.ontology().shaclObject();
    const graph = shacl['@graph'] as Array<Record<string, unknown>>;

    assert.ok(graph.length > 0, 'SHACL graph has nodes');
  });

  void it('handles schema with self-referencing $ref', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://edge.test',
      'schemas': [{
        '$id': 'https://edge.test/Tree',
        'properties': {
          'children': {
            'items': { '$ref': 'https://edge.test/Tree' },
            'type': 'array'
          },
          'label': { 'type': 'string' }
        },
        'required': ['label'],
        'type': 'object'
      }] as const
    });

    assert.deepEqual(jt.validate('https://edge.test/Tree', {
      'children': [{
        'children': [],
        'label': 'child'
      }],
      'label': 'root'
    }), [], 'recursive data validates');

    const owl = jt.ontology().jsonLdObject();

    assert.ok(owl['@graph'] !== undefined, 'recursive schema serializes without infinite loop');
  });
});

// ---------------------------------------------------------------------------
// JsonTology facade edge cases
// ---------------------------------------------------------------------------

void describe('JsonTology facade edge cases', () => {
  void it('returns expected values for unregistered schema lookups', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://edge.test' });

    const scenarios: Array<{ 'check': () => void;
      'name': string }> = [
      {
        'check': () => {
          assert.deepEqual(jt.list(), []);
        },
        'name': 'list() returns empty array when no schemas registered'
      },
      {
        'check': () => {
          assert.equal(jt.has('https://edge.test/Nonexistent'), false);
        },
        'name': 'has() returns false for unknown schema'
      },
      {
        'check': () => {
          assert.equal(jt.get('https://edge.test/Nonexistent'), undefined);
        },
        'name': 'get() returns undefined for unknown schema'
      },
      {
        'check': () => {
          assert.equal(jt.toSchema('https://edge.test/Nonexistent'), undefined);
        },
        'name': 'toSchema() returns undefined for unregistered schema'
      }
    ];

    for (const {
      check, name
    } of scenarios) {
      check();
      assert.ok(true, name);
    }
  });

  void it('register() chains and accumulates schemas', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://edge.test' });

    jt.register({
      '$id': 'https://edge.test/First',
      'type': 'object'
    });
    jt.register({
      '$id': 'https://edge.test/Second',
      'type': 'object'
    });

    assert.equal(jt.list().length, 2, 'two schemas registered');
    assert.ok(jt.has('https://edge.test/First'), 'First schema present');
    assert.ok(jt.has('https://edge.test/Second'), 'Second schema present');
  });

  void it('ontology cache invalidates after register()', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://edge.test',
      'schemas': [{
        '$id': 'https://edge.test/A',
        'type': 'object'
      }] as const
    });

    const ont1 = jt.ontology();

    jt.register({
      '$id': 'https://edge.test/B',
      'type': 'object'
    });

    const ont2 = jt.ontology();

    assert.notStrictEqual(ont1, ont2, 'new ontology instance after registration');
  });
});
