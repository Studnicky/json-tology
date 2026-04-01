/**
 * Materializer Edge Cases
 *
 * Tests for boundary conditions around default application, falsy values,
 * additional properties, null handling, and deeply nested schemas.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/JsonTology.js';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { Materializer } from '../../src/modules/materialization/materializer.js';

// ---------------------------------------------------------------------------
// Default application scenarios
// ---------------------------------------------------------------------------

interface DefaultScenario {
  'assertions': (result: Record<string, unknown>) => void;
  'input': Record<string, unknown>;
  'name': string;
  'schema': Record<string, unknown> & { '$id': string };
}

const defaultScenarios: DefaultScenario[] = [
  {
    'assertions': (result) => {
      assert.strictEqual(result.enabled, true, 'all defaults — enabled');
      assert.strictEqual(result.count, 10, 'all defaults — count');
      assert.strictEqual(result.color, 'blue', 'all defaults — color');
    },
    'input': {},
    'name': 'applies all defaults when no data is provided',
    'schema': {
      '$id': 'https://edge.io/all-defaults',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'color': {
          'default': 'blue',
          'type': 'string'
        },
        'count': {
          'default': 10,
          'type': 'number'
        },
        'enabled': {
          'default': true,
          'type': 'boolean'
        }
      },
      'type': 'object'
    }
  },
  {
    'assertions': (result) => {
      assert.deepStrictEqual(result.tags, ['general'], 'array default — tags');
    },
    'input': {},
    'name': 'applies default array values',
    'schema': {
      '$id': 'https://edge.io/array-default',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'tags': {
          'default': ['general'],
          'items': { 'type': 'string' },
          'type': 'array'
        }
      },
      'type': 'object'
    }
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.status, 'pending', 'enum default — status');
    },
    'input': {},
    'name': 'applies default enum value',
    'schema': {
      '$id': 'https://edge.io/enum-default',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'status': {
          'default': 'pending',
          'enum': [
            'active',
            'inactive',
            'pending'
          ],
          'type': 'string'
        }
      },
      'type': 'object'
    }
  },
  {
    'assertions': (result) => {
      assert.ok('alpha' in result, 'no defaults — alpha key present');
      assert.ok('beta' in result, 'no defaults — beta key present');
      assert.strictEqual(result.alpha, undefined, 'no defaults — alpha undefined');
      assert.strictEqual(result.beta, undefined, 'no defaults — beta undefined');
    },
    'input': {},
    'name': 'returns minimal object when schema has no defaults',
    'schema': {
      '$id': 'https://edge.io/no-defaults',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'alpha': { 'type': 'string' },
        'beta': { 'type': 'number' }
      },
      'type': 'object'
    }
  }
];

void describe('Materializer default application', () => {
  for (const scenario of defaultScenarios) {
    void it(scenario.name, () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);
      const result = materializer.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

      scenario.assertions(result);
    });
  }
});

// ---------------------------------------------------------------------------
// Falsy default preservation scenarios
// ---------------------------------------------------------------------------

interface FalsyScenario {
  'expected': unknown;
  'expectedType': string;
  'name': string;
  'property': string;
  'schema': Record<string, unknown> & { '$id': string };
}

const falsyScenarios: FalsyScenario[] = [
  {
    'expected': false,
    'expectedType': 'boolean',
    'name': 'preserves boolean default of false (falsy but valid)',
    'property': 'active',
    'schema': {
      '$id': 'https://edge.io/bool-false',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'active': {
          'default': false,
          'type': 'boolean'
        }
      },
      'type': 'object'
    }
  },
  {
    'expected': 0,
    'expectedType': 'number',
    'name': 'preserves numeric default of 0 (falsy but valid)',
    'property': 'offset',
    'schema': {
      '$id': 'https://edge.io/zero-default',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'offset': {
          'default': 0,
          'type': 'number'
        }
      },
      'type': 'object'
    }
  },
  {
    'expected': '',
    'expectedType': 'string',
    'name': 'preserves empty string default (falsy but valid)',
    'property': 'label',
    'schema': {
      '$id': 'https://edge.io/empty-string',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'label': {
          'default': '',
          'type': 'string'
        }
      },
      'type': 'object'
    }
  }
];

void describe('Materializer falsy default preservation', () => {
  for (const scenario of falsyScenarios) {
    void it(scenario.name, () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry);
      const result = materializer.materialize(scenario.schema, {}) as Record<string, unknown>;

      assert.strictEqual(result[scenario.property], scenario.expected, scenario.name);
      assert.strictEqual(typeof result[scenario.property], scenario.expectedType, `${scenario.name} — type`);
    });
  }
});

// ---------------------------------------------------------------------------
// Structured materialization scenarios ($ref defaults, deep nesting, facade)
// ---------------------------------------------------------------------------

interface StructuredScenario {
  'assertions': (result: Record<string, unknown>) => void;
  'extraSchemas'?: ReadonlyArray<Record<string, unknown>>;
  'input': Record<string, unknown>;
  'name': string;
  'schema': Record<string, unknown> & { '$id': string };
  'useFacade'?: boolean;
}

const structuredScenarios: StructuredScenario[] = [
  {
    'assertions': (result) => {
      const address = result.address as Record<string, unknown>;

      assert.strictEqual(address.city, 'Unknown', '$ref defaults — city');
      assert.strictEqual(address.zip, '00000', '$ref defaults — zip');
    },
    'extraSchemas': [{
      '$id': 'https://edge.io/address',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'city': {
          'default': 'Unknown',
          'type': 'string'
        },
        'zip': {
          'default': '00000',
          'type': 'string'
        }
      },
      'type': 'object'
    }],
    'input': {
      'address': {},
      'name': 'Alice'
    },
    'name': 'applies defaults from a referenced schema via $ref',
    'schema': {
      '$id': 'https://edge.io/person-ref',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'address': { '$ref': 'https://edge.io/address' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    }
  },
  {
    'assertions': (result) => {
      const level1 = result.level1 as Record<string, unknown>;
      const level3 = level1.level3 as Record<string, unknown>;

      assert.strictEqual(level3.leaf, 'deep-value', 'deep nesting — leaf default');
    },
    'input': { 'level1': { 'level3': {} } },
    'name': 'applies defaults through deeply nested schemas (3+ levels)',
    'schema': {
      '$defs': {
        'Level2': {
          'properties': {
            'level3': {
              'properties': {
                'leaf': {
                  'default': 'deep-value',
                  'type': 'string'
                }
              },
              'type': 'object'
            }
          },
          'type': 'object'
        }
      },
      '$id': 'https://edge.io/deep-nested',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': { 'level1': { '$ref': '#/$defs/Level2' } },
      'type': 'object'
    }
  },
  {
    'assertions': (result) => {
      assert.strictEqual(result.name, 'important', 'facade — name');
      assert.strictEqual(result.priority, 0, 'facade — falsy numeric default');
      assert.strictEqual(result.visible, false, 'facade — falsy boolean default');
    },
    'input': { 'name': 'important' },
    'name': 'materialize is accessible via JsonTology facade',
    'schema': {
      '$id': 'https://edge.io/tag',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': {
        'name': { 'type': 'string' },
        'priority': {
          'default': 0,
          'type': 'number'
        },
        'visible': {
          'default': false,
          'type': 'boolean'
        }
      },
      'required': ['name'],
      'type': 'object'
    },
    'useFacade': true
  }
];

void describe('Materializer structured scenarios', () => {
  for (const scenario of structuredScenarios) {
    void it(scenario.name, () => {
      if (scenario.useFacade === true) {
        const jt = JsonTology.create({
          'baseIRI': 'https://edge.io',
          'schemas': [scenario.schema] as const
        });
        const result = jt.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

        scenario.assertions(result);
      } else {
        const registry = new SchemaRegistry();

        for (const extra of scenario.extraSchemas ?? []) {
          registry.register(extra as Record<string, unknown> & { '$id': string });
        }
        const materializer = new Materializer(registry);
        const result = materializer.materialize(scenario.schema, scenario.input) as Record<string, unknown>;

        scenario.assertions(result);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Validation rejection scenarios (additional properties, null handling)
// ---------------------------------------------------------------------------

interface RejectionScenario {
  'input': Record<string, unknown>;
  'name': string;
  'options'?: { 'passAdditionalProperties'?: boolean };
  'schema': Record<string, unknown> & { '$id': string };
}

const rejectionScenarios: RejectionScenario[] = [
  {
    'input': {
      'extra': 'not allowed' as never,
      'name': 'test'
    },
    'name': 'rejects extra keys when additionalProperties is false',
    'schema': {
      '$id': 'https://edge.io/strict-extra',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'additionalProperties': false,
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    }
  },
  {
    'input': { 'label': null as unknown as string },
    'name': 'rejects null value for non-nullable property',
    'schema': {
      '$id': 'https://edge.io/non-nullable',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'properties': { 'label': { 'type': 'string' } },
      'required': ['label'],
      'type': 'object'
    }
  }
];

void describe('Materializer validation rejection', () => {
  for (const scenario of rejectionScenarios) {
    void it(scenario.name, () => {
      const registry = new SchemaRegistry();
      const materializer = new Materializer(registry, scenario.options);

      assert.throws(
        () => {
          return materializer.materialize(scenario.schema, scenario.input);
        },
        (err: Error) => {
          return err.message.includes('Invalid');
        },
        scenario.name
      );
    });
  }
});

// ---------------------------------------------------------------------------
// Additional properties pass-through
// ---------------------------------------------------------------------------

void describe('Materializer passAdditionalProperties', () => {
  void it('passes extra keys through when passAdditionalProperties is true', () => {
    const StrictSchema = {
      '$id': 'https://edge.io/strict-extra-pass',
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      'additionalProperties': false,
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    } as const;

    const registry = new SchemaRegistry();
    const materializer = new Materializer(registry, { 'passAdditionalProperties': true });

    const result = materializer.materialize(StrictSchema, {
      'extra': 'allowed' as never,
      'name': 'test'
    });

    assert.strictEqual(result.name, 'test', 'passAdditionalProperties — name');
    assert.strictEqual((result as Record<string, unknown>).extra, 'allowed', 'passAdditionalProperties — extra');
  });
});
