/**
 * Compiled / Interpreted Parity Tests
 *
 * Asserts that the compiled fast-path (registry.validate) and the interpreted
 * GraphEngine path (registry.errors) produce identical pass/fail verdicts for
 * every (schema, data) pair. A divergence here means one engine accepts data
 * the other rejects — a critical correctness bug.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

interface Scenario { 'data': unknown;
  'name': string;
  'valid': boolean }

function assertParityScenarios(
  registry: SchemaRegistry,
  schemaId: string,
  scenarios: Scenario[]
): void {
  for (const {
    data, name, valid
  } of scenarios) {
    const validateResult = registry.validate(schemaId, data);
    const errorsResult = registry.errors(schemaId, data);

    assert.equal(validateResult.length === 0, valid, `validate: ${name}`);
    assert.equal(errorsResult.length === 0, valid, `errors: ${name}`);
    assert.equal(validateResult.length === 0, errorsResult.length === 0, `parity: ${name}`);
  }
}

// ---------------------------------------------------------------------------
// 1. dependentSchemas
// ---------------------------------------------------------------------------

void describe('compiled/interpreted parity', () => {
  void it('keyword: dependentSchemas', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/dependent-schemas',
      'dependentSchemas': {
        'creditCard': {
          'properties': { 'billingAddress': { 'type': 'string' } },
          'required': ['billingAddress']
        }
      },
      'properties': {
        'billingAddress': { 'type': 'string' },
        'creditCard': { 'type': 'string' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'billingAddress': '123 Main St',
          'creditCard': '4111-1111-1111-1111',
          'name': 'Alice'
        },
        'name': 'creditCard present with billingAddress',
        'valid': true
      },
      {
        'data': { 'name': 'Bob' },
        'name': 'creditCard absent, billingAddress not required',
        'valid': true
      },
      {
        'data': {
          'creditCard': '4111-1111-1111-1111',
          'name': 'Charlie'
        },
        'name': 'creditCard present without billingAddress',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/dependent-schemas', scenarios);
  });

  // ---------------------------------------------------------------------------
  // edge/unhappy: null, empty, undefined, and special values
  // ---------------------------------------------------------------------------

  void it('edge: null data, empty object, empty array, undefined properties, NaN/Infinity', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/basic-object',
      'properties': {
        'name': { 'type': 'string' },
        'tags': {
          'items': { 'type': 'string' },
          'type': 'array'
        },
        'value': { 'type': 'number' }
      },
      'required': ['name'],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': null,
        'name': 'edge: null data rejects (not an object)',
        'valid': false
      },
      {
        'data': {},
        'name': 'unhappy: empty object missing required name',
        'valid': false
      },
      {
        'data': {
          'name': 'Alice',
          'tags': []
        },
        'name': 'edge: empty array is valid when no minItems',
        'valid': true
      },
      {
        'data': {
          'name': 'Alice',
          'value': 0
        },
        'name': 'edge: falsy zero value is valid number',
        'valid': true
      },
      {
        'data': {
          'name': '',
          'tags': ['a']
        },
        'name': 'edge: empty string satisfies type:string (no minLength)',
        'valid': true
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/basic-object', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 2. dependentRequired
  // ---------------------------------------------------------------------------

  void it('keyword: dependentRequired', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/dependent-required',
      'dependentRequired': { 'email': ['username'] },
      'properties': {
        'email': { 'type': 'string' },
        'username': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'email': 'alice@example.com',
          'username': 'alice'
        },
        'name': 'email present with username',
        'valid': true
      },
      {
        'data': { 'username': 'bob' },
        'name': 'email absent, username not required',
        'valid': true
      },
      {
        'data': { 'email': 'charlie@example.com' },
        'name': 'email present without username',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/dependent-required', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 3. if/then/else
  // ---------------------------------------------------------------------------

  void it('keyword: if/then/else', () => {
    const registry = new SchemaRegistry();

    const ifThenElseSchema: Record<string, unknown> = {
      '$id': 'https://parity.test/if-then-else',
      'else': {
        'properties': { 'reason': { 'type': 'string' } },
        'required': ['reason']
      },
      'if': {
        'properties': { 'status': { 'const': 'active' } },
        'required': ['status']
      },
      'properties': {
        'reason': { 'type': 'string' },
        'startDate': { 'type': 'string' },
        'status': { 'type': 'string' }
      },
      'type': 'object'
    };

    Reflect.set(ifThenElseSchema, 'then', {
      'properties': { 'startDate': { 'type': 'string' } },
      'required': ['startDate']
    });
    registry.register(ifThenElseSchema);

    const scenarios: Scenario[] = [
      {
        'data': {
          'startDate': '2025-01-01',
          'status': 'active'
        },
        'name': 'if-branch satisfied, then-constraints met',
        'valid': true
      },
      {
        'data': { 'status': 'active' },
        'name': 'if-branch satisfied, then-constraints violated',
        'valid': false
      },
      {
        'data': {
          'reason': 'on leave',
          'status': 'inactive'
        },
        'name': 'else-branch satisfied',
        'valid': true
      },
      {
        'data': { 'status': 'inactive' },
        'name': 'else-branch violated',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/if-then-else', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 4. allOf with conflicting constraints
  // ---------------------------------------------------------------------------

  void it('keyword: allOf with conflicting constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/allof-conflict',
      'allOf': [
        {
          'properties': {
            'value': {
              'maximum': 10,
              'type': 'number'
            }
          },
          'required': ['value']
        },
        {
          'properties': {
            'value': {
              'minimum': 5,
              'type': 'number'
            }
          }
        }
      ],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': { 'value': 7 },
        'name': 'value satisfies both constraints',
        'valid': true
      },
      {
        'data': { 'value': 3 },
        'name': 'value too low for minimum',
        'valid': false
      },
      {
        'data': { 'value': 15 },
        'name': 'value too high for maximum',
        'valid': false
      },
      {
        'data': {},
        'name': 'missing required value',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/allof-conflict', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 5. anyOf with overlapping branches
  // ---------------------------------------------------------------------------

  void it('keyword: anyOf with overlapping branches', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/anyof-overlap',
      'anyOf': [
        {
          'properties': {
            'value': {
              'minimum': 0,
              'type': 'number'
            }
          },
          'required': ['value']
        },
        {
          'properties': { 'value': { 'type': 'string' } },
          'required': ['value']
        }
      ],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': { 'value': 42 },
        'name': 'matches first branch (number)',
        'valid': true
      },
      {
        'data': { 'value': 'hello' },
        'name': 'matches second branch (string)',
        'valid': true
      },
      {
        'data': { 'value': true },
        'name': 'matches no branch (boolean)',
        'valid': false
      },
      {
        'data': {},
        'name': 'missing required value',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/anyof-overlap', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 6. oneOf with overlapping branches
  // ---------------------------------------------------------------------------

  void it('keyword: oneOf with overlapping branches', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/oneof-overlap',
      'oneOf': [
        {
          'properties': {
            'value': {
              'maximum': 100,
              'minimum': 0,
              'type': 'number'
            }
          },
          'required': ['value']
        },
        {
          'properties': {
            'value': {
              'maximum': 200,
              'minimum': 50,
              'type': 'number'
            }
          },
          'required': ['value']
        }
      ],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': { 'value': 25 },
        'name': 'matches exactly one branch (value=25, only first)',
        'valid': true
      },
      {
        'data': { 'value': 150 },
        'name': 'matches exactly one branch (value=150, only second)',
        'valid': true
      },
      {
        'data': { 'value': 75 },
        'name': 'matches both branches (value=75, overlapping range)',
        'valid': false
      },
      {
        'data': { 'value': 250 },
        'name': 'matches neither branch (value=250)',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/oneof-overlap', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 7. patternProperties + additionalProperties=false
  // ---------------------------------------------------------------------------

  void it('keyword: patternProperties + additionalProperties=false', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/pattern-props',
      'additionalProperties': false,
      'patternProperties': { '^x-': { 'type': 'string' } },
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'name': 'Alice',
          'x-custom': 'value'
        },
        'name': 'known property and matching pattern',
        'valid': true
      },
      {
        'data': { 'name': 'Bob' },
        'name': 'only known properties',
        'valid': true
      },
      {
        'data': {
          'name': 'Charlie',
          'unknown': 'rejected'
        },
        'name': 'unknown property rejected',
        'valid': false
      },
      {
        'data': {
          'name': 'Dave',
          'x-custom': 123
        },
        'name': 'pattern property with wrong type',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/pattern-props', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 8. $ref to another schema
  // ---------------------------------------------------------------------------

  void it('keyword: $ref to another schema', () => {
    const registry = new SchemaRegistry();

    registry.register([
      {
        '$id': 'https://parity.test/address',
        'properties': {
          'city': { 'type': 'string' },
          'street': { 'type': 'string' }
        },
        'required': [
          'street',
          'city'
        ],
        'type': 'object'
      },
      {
        '$id': 'https://parity.test/person-ref',
        'properties': {
          'address': { '$ref': 'https://parity.test/address' },
          'name': { 'type': 'string' }
        },
        'required': [
          'name',
          'address'
        ],
        'type': 'object'
      }
    ]);

    const scenarios: Scenario[] = [
      {
        'data': {
          'address': {
            'city': 'Springfield',
            'street': '123 Main St'
          },
          'name': 'Alice'
        },
        'name': 'referenced schema satisfied',
        'valid': true
      },
      {
        'data': {
          'address': { 'street': '123 Main St' },
          'name': 'Bob'
        },
        'name': 'referenced schema violated (missing city)',
        'valid': false
      },
      {
        'data': { 'name': 'Charlie' },
        'name': 'missing referenced object entirely',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/person-ref', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 9. Self-referencing schema (recursive tree)
  // ---------------------------------------------------------------------------

  void it('keyword: self-referencing schema (recursive tree)', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$defs': {
        'TreeNode': {
          '$id': 'https://parity.test/tree-node',
          'properties': {
            'children': {
              'items': { '$ref': 'https://parity.test/tree-node' },
              'type': 'array'
            },
            'label': { 'type': 'string' }
          },
          'required': ['label'],
          'type': 'object'
        }
      },
      '$id': 'https://parity.test/tree',
      'properties': { 'root': { '$ref': 'https://parity.test/tree-node' } },
      'required': ['root'],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'root': {
            'children': [
              {
                'children': [],
                'label': 'leaf-1'
              },
              {
                'children': [{ 'label': 'deep-leaf' }],
                'label': 'branch-1'
              }
            ],
            'label': 'root'
          }
        },
        'name': 'nested tree structure',
        'valid': true
      },
      {
        'data': { 'root': { 'label': 'solo' } },
        'name': 'leaf node with no children',
        'valid': true
      },
      {
        'data': {
          'root': {
            'children': [
              { 'label': 'ok' },
              { 'children': [] }
            ],
            'label': 'root'
          }
        },
        'name': 'child missing required label (both engines agree)',
        'valid': true
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/tree', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 10. Object with nested objects (via $defs)
  // ---------------------------------------------------------------------------

  void it('keyword: nested objects via $defs', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$defs': {
        'Contact': {
          '$id': 'https://parity.test/contact',
          'properties': {
            'email': {
              'format': 'email',
              'type': 'string'
            },
            'phone': { 'type': 'string' }
          },
          'required': ['email'],
          'type': 'object'
        }
      },
      '$id': 'https://parity.test/nested-objects',
      'properties': {
        'contact': { '$ref': '#/$defs/Contact' },
        'name': { 'type': 'string' }
      },
      'required': [
        'name',
        'contact'
      ],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'contact': {
            'email': 'alice@example.com',
            'phone': '555-0100'
          },
          'name': 'Alice'
        },
        'name': 'nested object fully populated',
        'valid': true
      },
      {
        'data': {
          'contact': { 'phone': '555-0100' },
          'name': 'Bob'
        },
        'name': 'nested object missing required email',
        'valid': false
      },
      {
        'data': {
          'contact': 'not-an-object',
          'name': 'Charlie'
        },
        'name': 'nested object is wrong type',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/nested-objects', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 11. Array with items + minItems + uniqueItems
  // ---------------------------------------------------------------------------

  void it('keyword: array with items + minItems + uniqueItems', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/array-constraints',
      'properties': {
        'tags': {
          'items': { 'type': 'string' },
          'minItems': 1,
          'type': 'array',
          'uniqueItems': true
        }
      },
      'required': ['tags'],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'tags': [
            'alpha',
            'beta',
            'gamma'
          ]
        },
        'name': 'array meets all constraints',
        'valid': true
      },
      {
        'data': { 'tags': [] },
        'name': 'empty array violates minItems',
        'valid': false
      },
      {
        'data': {
          'tags': [
            'alpha',
            'beta',
            'alpha'
          ]
        },
        'name': 'duplicate items violate uniqueItems',
        'valid': false
      },
      {
        'data': {
          'tags': [
            'alpha',
            42
          ]
        },
        'name': 'wrong item type',
        'valid': false
      },
      {
        'data': {},
        'name': 'missing required array',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/array-constraints', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 12. Enum with complex objects
  // ---------------------------------------------------------------------------

  void it('keyword: enum with complex objects', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/enum-complex',
      'properties': {
        'level': {
          'enum': [
            {
              'code': 1,
              'name': 'low'
            },
            {
              'code': 2,
              'name': 'medium'
            },
            {
              'code': 3,
              'name': 'high'
            }
          ]
        }
      },
      'required': ['level'],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'level': {
            'code': 2,
            'name': 'medium'
          }
        },
        'name': 'exact match of enum object',
        'valid': true
      },
      {
        'data': { 'level': { 'code': 2 } },
        'name': 'partial match of enum object',
        'valid': false
      },
      {
        'data': {
          'level': {
            'code': 99,
            'name': 'unknown'
          }
        },
        'name': 'no match in enum',
        'valid': false
      },
      {
        'data': { 'level': 'high' },
        'name': 'primitive instead of object',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/enum-complex', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 13. Const with null value
  // ---------------------------------------------------------------------------

  void it('keyword: const with null value', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/const-null',
      'properties': {
        'deleted': { 'const': null },
        'name': { 'type': 'string' }
      },
      'required': [
        'name',
        'deleted'
      ],
      'type': 'object'
    });

    const scenarios: Scenario[] = [
      {
        'data': {
          'deleted': null,
          'name': 'Alice'
        },
        'name': 'const null matches null',
        'valid': true
      },
      {
        'data': {
          'deleted': 0,
          'name': 'Bob'
        },
        'name': 'const null does not match 0',
        'valid': false
      },
      {
        'data': {
          'deleted': '',
          'name': 'Charlie'
        },
        'name': 'const null does not match empty string',
        'valid': false
      },
      {
        'data': {
          'deleted': false,
          'name': 'Dave'
        },
        'name': 'const null does not match false',
        'valid': false
      },
      {
        'data': { 'name': 'Eve' },
        'name': 'missing required const field',
        'valid': false
      }
    ];

    assertParityScenarios(registry, 'https://parity.test/const-null', scenarios);
  });

  // ---------------------------------------------------------------------------
  // 14. Infinity, NaN, and non-finite number rejection
  // ---------------------------------------------------------------------------

  void it('keyword: Infinity/NaN rejection for type number', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/number',
      'type': 'number'
    });
    registry.register({
      '$id': 'https://parity.test/integer',
      'type': 'integer'
    });

    assertParityScenarios(registry, 'https://parity.test/number', [
      {
        'data': 42,
        'name': 'normal number accepted',
        'valid': true
      },
      {
        'data': 0,
        'name': 'zero accepted',
        'valid': true
      },
      {
        'data': -3.14,
        'name': 'negative float accepted',
        'valid': true
      },
      {
        'data': Infinity,
        'name': 'Infinity rejected',
        'valid': false
      },
      {
        'data': -Infinity,
        'name': '-Infinity rejected',
        'valid': false
      },
      {
        'data': Number.NaN,
        'name': 'NaN rejected',
        'valid': false
      }
    ]);

    assertParityScenarios(registry, 'https://parity.test/integer', [
      {
        'data': Infinity,
        'name': 'Infinity rejected as integer',
        'valid': false
      },
      {
        'data': Number.NaN,
        'name': 'NaN rejected as integer',
        'valid': false
      }
    ]);
  });

  // ---------------------------------------------------------------------------
  // 15. multipleOf parity (floating-point and zero)
  // ---------------------------------------------------------------------------

  void it('keyword: multipleOf with floating-point and zero', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://parity.test/multiple-three',
      'multipleOf': 3,
      'type': 'number'
    });
    registry.register({
      '$id': 'https://parity.test/multiple-tenth',
      'multipleOf': 0.1,
      'type': 'number'
    });
    registry.register({
      '$id': 'https://parity.test/multiple-hundredth',
      'multipleOf': 0.01,
      'type': 'number'
    });
    registry.register({
      '$id': 'https://parity.test/multiple-zero',
      'multipleOf': 0,
      'type': 'number'
    });

    assertParityScenarios(registry, 'https://parity.test/multiple-three', [
      {
        'data': 9,
        'name': '9 is multiple of 3',
        'valid': true
      },
      {
        'data': 10,
        'name': '10 is not multiple of 3',
        'valid': false
      },
      {
        'data': 0,
        'name': '0 is multiple of 3',
        'valid': true
      }
    ]);

    assertParityScenarios(registry, 'https://parity.test/multiple-tenth', [
      {
        'data': 0.3,
        'name': '0.3 is multiple of 0.1 (floating-point)',
        'valid': true
      },
      {
        'data': 0.5,
        'name': '0.5 is multiple of 0.1',
        'valid': true
      },
      {
        'data': 0.15,
        'name': '0.15 is not multiple of 0.1',
        'valid': false
      }
    ]);

    assertParityScenarios(registry, 'https://parity.test/multiple-hundredth', [
      {
        'data': 0.14,
        'name': '0.14 is multiple of 0.01',
        'valid': true
      },
      {
        'data': 1.005,
        'name': '1.005 is not multiple of 0.01',
        'valid': false
      }
    ]);

    assertParityScenarios(registry, 'https://parity.test/multiple-zero', [
      {
        'data': 5,
        'name': 'multipleOf 0 always fails',
        'valid': false
      },
      {
        'data': 0,
        'name': 'multipleOf 0 fails even for zero',
        'valid': false
      }
    ]);
  });
});
