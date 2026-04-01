/**
 * $ref Resolution, Deep Nesting, and Self-Referencing Schema Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { Logger } from '../utils/Logger.js';

const logger = new Logger({ 'silent': true });

interface ValidationScenario { 'data': unknown;
  'name': string;
  'valid': boolean }

function assertValidationScenarios(
  registry: SchemaRegistry,
  schemaId: string,
  scenarios: ValidationScenario[]
): void {
  for (const {
    data, name, valid
  } of scenarios) {
    const errors = registry.validate(schemaId, data);

    if (valid) {
      assert.strictEqual(errors.length, 0, `expected valid: ${name}`);
    } else {
      assert.ok(errors.length > 0, `expected invalid: ${name}`);
    }
  }
}

// ---------------------------------------------------------------------------
// Self-Referencing Schemas
// ---------------------------------------------------------------------------

void describe('Self-referencing schemas', () => {
  void it('validates a tree structure with recursive $ref', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$id': 'https://ref.test/Tree',
      'properties': {
        'children': {
          'items': { '$ref': 'https://ref.test/Tree' },
          'type': 'array'
        },
        'value': { 'type': 'string' }
      },
      'required': ['value'],
      'type': 'object'
    });

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'children': [
            {
              'children': [
                { 'value': 'grandchild-1' },
                { 'value': 'grandchild-2' }
              ],
              'value': 'child-1'
            },
            { 'value': 'child-2' }
          ],
          'value': 'root'
        },
        'name': 'valid 3-level deep tree',
        'valid': true
      },
      {
        'data': {
          'children': [{
            'children': [{ 'notValue': 'missing value key' }],
            'value': 'child-1'
          }],
          'value': 'root'
        },
        'name': 'nested child missing required value',
        'valid': false
      },
      {
        'data': null,
        'name': 'edge: null at root level',
        'valid': false
      },
      {
        'data': {
          'children': [null],
          'value': 'root'
        },
        'name': 'edge: null inside children array at ref position',
        'valid': false
      },
      {
        'data': {
          'children': [],
          'value': 'root'
        },
        'name': 'edge: empty children array is valid',
        'valid': true
      },
      {
        'data': {
          'children': [{}],
          'value': 'root'
        },
        'name': 'unhappy: empty object at ref position — missing required value',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/Tree', scenarios);
  });

  void it('validates a linked list with recursive optional $ref', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$id': 'https://ref.test/ListNode',
      'properties': {
        'next': { '$ref': 'https://ref.test/ListNode' },
        'value': { 'type': 'number' }
      },
      'required': ['value'],
      'type': 'object'
    });

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'next': {
            'next': { 'value': 3 },
            'value': 2
          },
          'value': 1
        },
        'name': 'valid linked list 1 -> 2 -> 3',
        'valid': true
      },
      {
        'data': {
          'next': {
            'next': { 'value': 3 },
            'value': 'not-a-number'
          },
          'value': 1
        },
        'name': 'middle node has wrong type for value',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/ListNode', scenarios);
  });

  void it('validates self-referencing via $defs', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$defs': {
        'Node': {
          'properties': {
            'children': {
              'items': { '$ref': '#/$defs/Node' },
              'type': 'array'
            },
            'label': { 'type': 'string' }
          },
          'required': ['label'],
          'type': 'object'
        }
      },
      '$id': 'https://ref.test/SelfDefs',
      'properties': { 'root': { '$ref': '#/$defs/Node' } },
      'type': 'object'
    });

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'root': {
            'children': [{
              'children': [],
              'label': 'leaf'
            }],
            'label': 'top'
          }
        },
        'name': 'valid nested node via $defs',
        'valid': true
      },
      {
        'data': {
          'root': {
            'children': [{ 'children': [] }],
            'label': 'top'
          }
        },
        'name': 'nested node missing required label',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/SelfDefs', scenarios);
  });
});

// ---------------------------------------------------------------------------
// Cross-Schema References
// ---------------------------------------------------------------------------

void describe('Cross-schema references', () => {
  void it('validates mutual recursion between two schemas', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register([
      {
        '$id': 'https://ref.test/Person',
        'properties': {
          'bestFriend': { '$ref': 'https://ref.test/Pet' },
          'name': { 'type': 'string' }
        },
        'required': ['name'],
        'type': 'object'
      },
      {
        '$id': 'https://ref.test/Pet',
        'properties': {
          'breed': { 'type': 'string' },
          'owner': { '$ref': 'https://ref.test/Person' }
        },
        'required': ['breed'],
        'type': 'object'
      }
    ]);

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'bestFriend': {
            'breed': 'Labrador',
            'owner': { 'name': 'Alice' }
          },
          'name': 'Alice'
        },
        'name': 'valid mutual reference',
        'valid': true
      },
      {
        'data': {
          'bestFriend': { 'owner': { 'name': 'Bob' } },
          'name': 'Bob'
        },
        'name': 'referenced Pet missing required breed',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/Person', scenarios);
  });

  void it('validates a three-level reference chain A -> B -> C', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register([
      {
        '$id': 'https://ref.test/ChainC',
        'properties': { 'code': { 'type': 'string' } },
        'required': ['code'],
        'type': 'object'
      },
      {
        '$id': 'https://ref.test/ChainB',
        'properties': {
          'detail': { '$ref': 'https://ref.test/ChainC' },
          'level': { 'type': 'number' }
        },
        'required': ['level'],
        'type': 'object'
      },
      {
        '$id': 'https://ref.test/ChainA',
        'properties': {
          'child': { '$ref': 'https://ref.test/ChainB' },
          'name': { 'type': 'string' }
        },
        'required': ['name'],
        'type': 'object'
      }
    ]);

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'child': {
            'detail': { 'code': 'X-99' },
            'level': 2
          },
          'name': 'top'
        },
        'name': 'valid chain A -> B -> C',
        'valid': true
      },
      {
        'data': {
          'child': {
            'detail': {},
            'level': 2
          },
          'name': 'top'
        },
        'name': 'deepest schema missing required code',
        'valid': false
      },
      {
        'data': {
          'child': {
            'detail': null,
            'level': 2
          },
          'name': 'top'
        },
        'name': 'edge: null at deeply nested ref position (detail)',
        'valid': false
      },
      {
        'data': {
          'child': null,
          'name': 'top'
        },
        'name': 'edge: null at intermediate ref position (child)',
        'valid': false
      },
      {
        'data': { 'name': 'top' },
        'name': 'edge: missing optional child ref — valid (not required)',
        'valid': true
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/ChainA', scenarios);
  });

  void it('handles reference to a non-existent schema gracefully', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$id': 'https://ref.test/Dangling',
      'properties': { 'link': { '$ref': 'https://ref.test/DoesNotExist' } },
      'type': 'object'
    });

    // registration succeeds; validation does not throw
    const errors = registry.validate('https://ref.test/Dangling', { 'link': {} });

    // the registry produces a result without crashing — the unresolved $ref
    // is either silently accepted or flagged; either way no exception is thrown
    assert.ok(Array.isArray(errors));
  });
});

// ---------------------------------------------------------------------------
// $anchor and $defs
// ---------------------------------------------------------------------------

void describe('$anchor and $defs resolution', () => {
  void it('resolves $ref to $anchor within the same schema', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$defs': {
        'EmailType': {
          '$anchor': 'emailDef',
          'format': 'email',
          'type': 'string'
        }
      },
      '$id': 'https://ref.test/WithAnchor',
      'properties': { 'contactEmail': { '$ref': '#emailDef' } },
      'type': 'object'
    });

    const scenarios: ValidationScenario[] = [
      {
        'data': { 'contactEmail': 'user@example.com' },
        'name': 'valid email via $anchor ref',
        'valid': true
      },
      {
        'data': { 'contactEmail': 12_345 },
        'name': 'invalid type via $anchor ref',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/WithAnchor', scenarios);
  });

  void it('resolves $ref to $defs via JSON pointer', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$defs': {
        'Address': {
          'properties': {
            'city': { 'type': 'string' },
            'zip': { 'type': 'string' }
          },
          'required': ['city'],
          'type': 'object'
        }
      },
      '$id': 'https://ref.test/WithPointer',
      'properties': {
        'home': { '$ref': '#/$defs/Address' },
        'work': { '$ref': '#/$defs/Address' }
      },
      'type': 'object'
    });

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'home': {
            'city': 'Springfield',
            'zip': '62704'
          },
          'work': { 'city': 'Shelbyville' }
        },
        'name': 'both properties satisfy Address definition',
        'valid': true
      },
      {
        'data': {
          'home': { 'zip': '62704' },
          'work': { 'city': 'Shelbyville' }
        },
        'name': 'home missing required city',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/WithPointer', scenarios);
  });
});

// ---------------------------------------------------------------------------
// Deep Nesting
// ---------------------------------------------------------------------------

void describe('Deep nesting', () => {
  void it('validates 10+ levels of nested objects via $ref chain', () => {
    const registry = new SchemaRegistry({ logger });

    const depth = 12;
    const baseUrl = 'https://ref.test/deep';

    // Build 12 separate schemas, each referencing the next via $ref
    // Level 0 is the leaf, levels 1..11 wrap it
    const schemas: Array<Record<string, unknown>> = [];

    schemas.push({
      '$id': `${baseUrl}/Level0`,
      'properties': { 'leaf': { 'type': 'string' } },
      'required': ['leaf'],
      'type': 'object'
    });

    for (let level = 1; level < depth; level++) {
      const key = `level${level}`;

      schemas.push({
        '$id': `${baseUrl}/Level${String(level)}`,
        'properties': { [key]: { '$ref': `${baseUrl}/Level${String(level - 1)}` } },
        'required': [key],
        'type': 'object'
      });
    }

    registry.register(schemas);

    const topId = `${baseUrl}/Level${String(depth - 1)}`;

    const buildDeepData = (leafValue: unknown): Record<string, unknown> => {
      let data: Record<string, unknown> = { 'leaf': leafValue };

      for (let level = 1; level < depth; level++) {
        data = { [`level${level}`]: data };
      }

      return data;
    };

    const scenarios: ValidationScenario[] = [
      {
        'data': buildDeepData('found'),
        'name': 'valid leaf at depth 12',
        'valid': true
      },
      {
        'data': buildDeepData(42),
        'name': 'wrong type at deepest leaf',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, topId, scenarios);
  });

  void it('applies defaults at multiple nesting levels', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register({
      '$id': 'https://ref.test/DeepDefaults',
      'properties': {
        'outer': {
          '$id': 'https://ref.test/DeepDefaults/Outer',
          'default': {},
          'properties': {
            'inner': {
              '$id': 'https://ref.test/DeepDefaults/Inner',
              'default': {},
              'properties': {
                'value': {
                  'default': 'fallback',
                  'type': 'string'
                }
              },
              'type': 'object'
            }
          },
          'type': 'object'
        }
      },
      'type': 'object'
    });

    // coerce should apply defaults at each level
    const result = registry.coerce(
      'https://ref.test/DeepDefaults',
      { 'outer': { 'inner': {} } }
    ) as Record<string, unknown>;

    const outer = result.outer as Record<string, unknown>;
    const inner = outer.inner as Record<string, unknown>;

    assert.strictEqual(inner.value, 'fallback');
  });
});

// ---------------------------------------------------------------------------
// $ref with Sibling Keywords (2020-12 Merge Semantics)
// ---------------------------------------------------------------------------

void describe('$ref with sibling keywords', () => {
  void it('merges $ref with sibling properties in 2020-12 dialect', () => {
    const registry = new SchemaRegistry({ logger });

    registry.register([
      {
        '$id': 'https://ref.test/Base',
        'properties': { 'name': { 'type': 'string' } },
        'required': ['name'],
        'type': 'object'
      },
      {
        '$id': 'https://ref.test/Extended',
        '$ref': 'https://ref.test/Base',
        'properties': { 'age': { 'type': 'number' } },
        'required': ['age'],
        'type': 'object'
      }
    ]);

    const scenarios: ValidationScenario[] = [
      {
        'data': {
          'age': 30,
          'name': 'Alice'
        },
        'name': 'satisfies both $ref target and local requirements',
        'valid': true
      },
      {
        'data': { 'name': 'Alice' },
        'name': 'missing age from sibling keywords',
        'valid': false
      },
      {
        'data': { 'age': 30 },
        'name': 'missing name from $ref target',
        'valid': false
      }
    ];

    assertValidationScenarios(registry, 'https://ref.test/Extended', scenarios);
  });
});
