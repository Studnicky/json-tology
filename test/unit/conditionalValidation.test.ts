/**
 * Conditional and Composition Validation Edge Cases
 *
 * Tests if/then/else, allOf, anyOf, oneOf, not, dependentRequired,
 * dependentSchemas, and their interactions.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';

function setSchemaKey(target: Record<string, unknown>, key: string, value: unknown): Record<string, unknown> {
  Reflect.set(target, key, value);

  return target;
}

// eslint-disable-next-line @stylistic/max-len
function makeThenElseSchema(id: string, ifSchema: unknown, thenSchema: unknown, elseSchema?: unknown): Record<string, unknown> {
  const schema: Record<string, unknown> = {
    '$id': id,
    'if': ifSchema,
    'type': 'object'
  };

  setSchemaKey(schema, 'then', thenSchema);
  if (elseSchema !== undefined) {
    setSchemaKey(schema, 'else', elseSchema);
  }

  return schema;
}

// ---------------------------------------------------------------------------
// if/then/else
// ---------------------------------------------------------------------------

void describe('if/then/else validation', () => {
  void it('validates then branch when if matches', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/ITE1';

    registry.register(makeThenElseSchema(
      schemaId,
      { 'properties': { 'kind': { 'const': 'person' } } },
      {
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name']
      }
    ));

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'kind': 'person',
          'name': 'Alice'
        },
        'name': 'if matches (kind=person) and then satisfied',
        'valid': true
      },
      {
        'data': { 'kind': 'person' },
        'name': 'if matches (kind=person) but then not satisfied — missing name',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates else branch when if does not match', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/ITE2';

    registry.register(makeThenElseSchema(
      schemaId,
      { 'properties': { 'kind': { 'const': 'org' } } },
      {
        'properties': { 'orgName': { 'type': 'string' } },
        'required': ['orgName']
      },
      {
        'properties': { 'label': { 'type': 'string' } },
        'required': ['label']
      }
    ));

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'kind': 'person',
          'label': 'Alice'
        },
        'name': 'if does not match — else requires label — satisfied',
        'valid': true
      },
      {
        'data': { 'kind': 'person' },
        'name': 'if does not match — else requires label — missing',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates if does not match and no else branch', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/ITE3';

    registry.register(makeThenElseSchema(
      schemaId,
      { 'properties': { 'kind': { 'const': 'special' } } },
      {
        'properties': { 'code': { 'type': 'number' } },
        'required': ['code']
      }
    ));

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [{
      'data': { 'kind': 'normal' },
      'name': 'if does not match, no else — passes',
      'valid': true
    }];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// allOf
// ---------------------------------------------------------------------------

void describe('allOf validation', () => {
  void it('validates allOf requiring all subschemas to match', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/AllOf1';

    registry.register({
      '$id': schemaId,
      'allOf': [
        {
          'properties': { 'name': { 'type': 'string' } },
          'required': ['name']
        },
        {
          'properties': { 'age': { 'type': 'number' } },
          'required': ['age']
        }
      ],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'age': 30,
          'name': 'Alice'
        },
        'name': 'both name and age present',
        'valid': true
      },
      {
        'data': { 'name': 'Alice' },
        'name': 'missing age',
        'valid': false
      },
      {
        'data': { 'age': 30 },
        'name': 'missing name',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates allOf with overlapping property constraints', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/AllOfOverlap';

    registry.register({
      '$id': schemaId,
      'allOf': [
        {
          'properties': {
            'x': {
              'minimum': 0,
              'type': 'number'
            }
          }
        },
        {
          'properties': {
            'x': {
              'maximum': 100,
              'type': 'number'
            }
          }
        }
      ],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'x': 50 },
        'name': 'x within both constraints',
        'valid': true
      },
      {
        'data': { 'x': -1 },
        'name': 'x below minimum',
        'valid': false
      },
      {
        'data': { 'x': 101 },
        'name': 'x above maximum',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// anyOf
// ---------------------------------------------------------------------------

void describe('anyOf validation', () => {
  void it('validates anyOf accepting data matching any branch', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/AnyOf1';

    registry.register({
      '$id': schemaId,
      'properties': {
        'val': {
          'anyOf': [
            { 'type': 'string' },
            { 'type': 'number' }
          ]
        }
      },
      'required': ['val'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'val': 'hello' },
        'name': 'string matches first branch',
        'valid': true
      },
      {
        'data': { 'val': 42 },
        'name': 'number matches second branch',
        'valid': true
      },
      {
        'data': { 'val': true },
        'name': 'boolean matches neither branch',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// oneOf
// ---------------------------------------------------------------------------

void describe('oneOf validation', () => {
  void it('validates oneOf accepting data matching exactly one branch', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/OneOf1';

    registry.register({
      '$id': schemaId,
      'properties': {
        'val': {
          'oneOf': [
            {
              'maximum': 10,
              'type': 'number'
            },
            {
              'minimum': 20,
              'type': 'number'
            }
          ]
        }
      },
      'required': ['val'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'val': 5 },
        'name': 'matches first branch only (val <= 10)',
        'valid': true
      },
      {
        'data': { 'val': 25 },
        'name': 'matches second branch only (val >= 20)',
        'valid': true
      },
      {
        'data': { 'val': 15 },
        'name': 'matches neither (between 10 and 20)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// not
// ---------------------------------------------------------------------------

void describe('not validation', () => {
  void it('validates not rejecting data matching the negated schema', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/Not1';

    registry.register({
      '$id': schemaId,
      'properties': {
        'val': {
          'not': { 'type': 'string' },
          'type': [
            'string',
            'number'
          ]
        }
      },
      'required': ['val'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'val': 42 },
        'name': 'number does not match negated string schema',
        'valid': true
      },
      {
        'data': { 'val': 'hello' },
        'name': 'string matches negated schema — rejected',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// dependentRequired
// ---------------------------------------------------------------------------

void describe('dependentRequired validation', () => {
  void it('validates dependent properties when trigger is present', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/DepReq1';

    registry.register({
      '$id': schemaId,
      'dependentRequired': {
        'email': ['name'],
        'name': ['email']
      },
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'email': 'a@b.c',
          'name': 'Alice'
        },
        'name': 'both present — valid',
        'valid': true
      },
      {
        'data': {},
        'name': 'neither present — valid',
        'valid': true
      },
      {
        'data': { 'name': 'Alice' },
        'name': 'name without email — invalid',
        'valid': false
      },
      {
        'data': { 'email': 'a@b.c' },
        'name': 'email without name — invalid',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// dependentSchemas
// ---------------------------------------------------------------------------

void describe('dependentSchemas validation', () => {
  void it('validates dependent schema when trigger property is present', () => {
    const registry = new SchemaRegistry();
    const schemaId = 'https://cond.test/DepSchema1';

    const schema: Record<string, unknown> = {
      '$id': schemaId,
      'dependentSchemas': {
        'billing': {
          'properties': { 'billingAddress': { 'type': 'string' } },
          'required': ['billingAddress']
        }
      },
      'properties': {
        'billing': { 'type': 'boolean' },
        'billingAddress': { 'type': 'string' }
      },
      'type': 'object'
    };

    registry.register(schema);

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {},
        'name': 'billing absent — no dependent constraint',
        'valid': true
      },
      {
        'data': {
          'billing': true,
          'billingAddress': '123 Main St'
        },
        'name': 'billing present — billingAddress provided',
        'valid': true
      },
      {
        'data': { 'billing': true },
        'name': 'billing present — billingAddress missing',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate(schemaId, data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// uniqueItems
// ---------------------------------------------------------------------------

void describe('uniqueItems validation', () => {
  void it('validates uniqueItems scenarios', () => {
    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'schema': Record<string, unknown>;
      'valid': boolean }> = [
      {
        'data': {
          'tags': [
            'a',
            'b',
            'c'
          ]
        },
        'name': 'unique items — valid',
        'schema': {
          '$id': 'https://cond.test/Unique1',
          'properties': {
            'tags': {
              'items': { 'type': 'string' },
              'type': 'array',
              'uniqueItems': true
            }
          },
          'required': ['tags'],
          'type': 'object'
        },
        'valid': true
      },
      {
        'data': {
          'tags': [
            'a',
            'b',
            'a'
          ]
        },
        'name': 'duplicate items — rejected',
        'schema': {
          '$id': 'https://cond.test/Unique1b',
          'properties': {
            'tags': {
              'items': { 'type': 'string' },
              'type': 'array',
              'uniqueItems': true
            }
          },
          'required': ['tags'],
          'type': 'object'
        },
        'valid': false
      },
      {
        'data': { 'list': [] },
        'name': 'empty array with uniqueItems — valid',
        'schema': {
          '$id': 'https://cond.test/Unique2',
          'properties': {
            'list': {
              'type': 'array',
              'uniqueItems': true
            }
          },
          'required': ['list'],
          'type': 'object'
        },
        'valid': true
      }
    ];

    for (const {
      data, name, schema, valid
    } of scenarios) {
      const registry = new SchemaRegistry();

      registry.register(schema);
      assert.equal(registry.validate(schema.$id as string, data).length === 0, valid, name);
    }
  });
});
