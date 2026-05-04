/**
 * Schema Registry Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Logger } from '../utils/Logger.js';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { CoercionError } from '../../src/errors/CoercionError.js';

const TestSchema = {
  '$id': 'https://example.io/test-schema',
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const TestSchemaWithDefs = {
  '$defs': {
    'Person': {
      'properties': {
        'email': { 'type': 'string' },
        'name': { 'type': 'string' }
      },
      'required': ['name'],
      'type': 'object'
    }
  },
  '$id': 'https://example.io/schema-with-defs',
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  'properties': { 'person': { '$ref': '#/$defs/Person' } },
  'type': 'object'
} as const;

const DuplicateSchema = {
  '$id': 'https://example.io/duplicate-1',
  'properties': { 'value': { 'type': 'string' } },
  'type': 'object'
};

const InvalidInlineSchema = {
  '$id': 'https://example.io/invalid-inline',
  'properties': {
    'nested': {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    }
  },
  'type': 'object'
} as const;

const InvalidOverwriteSchema = {
  '$id': TestSchema.$id,
  'properties': {
    'nested': {
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    }
  },
  'type': 'object'
} as const;

function mockLogger(logs: string[]) {
  return {
    'debug': (msg: string) => {
      return logs.push(msg);
    },
    'error': (msg: string) => {
      return logs.push(`ERROR: ${msg}`);
    },
    'fatal': (msg: string) => {
      return logs.push(`FATAL: ${msg}`);
    },
    'info': (msg: string) => {
      return logs.push(msg);
    },
    'trace': (msg: string) => {
      return logs.push(msg);
    },
    'warn': (msg: string) => {
      return logs.push(`WARN: ${msg}`);
    }
  };
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

void describe('SchemaRegistry registration', () => {
  const registrationScenarios: Array<{
    'check': (registry: SchemaRegistry) => void;
    'name': string;
    'setup': (registry: SchemaRegistry) => void;
  }> = [
    {
      'check': (registry) => {
        const retrieved = registry.get('https://example.io/test-schema');

        assert.ok(retrieved);
        assert.deepStrictEqual(retrieved, TestSchema);
      },
      'name': 'registers a single schema and retrieves it by $id',
      'setup': (registry) => {
        registry.register(TestSchema);
      }
    },
    {
      'check': (registry) => {
        assert.ok(registry.get('https://example.io/test-schema'));
        assert.ok(registry.get('https://example.io/schema-with-defs'));
      },
      'name': 'registers an array of schemas',
      'setup': (registry) => {
        registry.register([
          TestSchema,
          TestSchemaWithDefs
        ]);
      }
    },
    {
      'check': (registry) => {
        assert.ok(registry.get('https://example.io/test-schema'));
        assert.ok(registry.get('https://example.io/schema-with-defs'));
      },
      'name': 'registers single then array (mixed)',
      'setup': (registry) => {
        registry.register(TestSchema);
        registry.register([TestSchemaWithDefs]);
      }
    },
    {
      'check': (registry) => {
        assert.ok(registry.get('https://example.io/test-schema'));
      },
      'name': 'idempotent: identical schema object registered twice',
      'setup': (registry) => {
        registry.register(TestSchema);
        registry.register(TestSchema);
      }
    },
    {
      'check': (registry) => {
        const first = registry.graph(TestSchema.$id);
        const second = registry.graph(TestSchema.$id);
        const listed = registry.listGraphs();

        assert.ok(first);
        assert.strictEqual(first, second);
        assert.ok(listed.includes(first));
      },
      'name': 'caches canonical graphs per registered schema',
      'setup': (registry) => {
        registry.register([
          TestSchema,
          TestSchemaWithDefs
        ]);
      }
    },
    {
      'check': (registry) => {
        const schemaNoId: Record<string, unknown> = { 'type': 'object' };

        assert.throws(
          () => {
            registry.register(schemaNoId);
          },
          (err: Error) => {
            return err.message.includes('Schema must have a $id property');
          }
        );
      },
      'name': 'throws when schema has no $id',
      'setup': () => {
        // no setup needed
      }
    },
    {
      'check': (registry) => {
        assert.ok(registry.get('https://example.io/Address'));
        assert.ok(registry.get('https://example.io/User'));
      },
      'name': 'registration succeeds with proper $ref patterns',
      'setup': (registry) => {
        registry.register([
          {
            '$id': 'https://example.io/Address',
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          },
          {
            '$id': 'https://example.io/User',
            'properties': { 'address': { '$ref': 'https://example.io/Address' } },
            'type': 'object'
          }
        ]);
      }
    },
    {
      'check': () => {
        // Default mode: inline schemas register silently (no throw)
        const defaultRegistry = new SchemaRegistry({ 'logger': new Logger() });

        assert.doesNotThrow(() => {
          defaultRegistry.register(InvalidInlineSchema);
        });
        assert.ok(defaultRegistry.get(InvalidInlineSchema.$id) !== undefined);

        // enableStrictGraph mode: inline schemas throw SchemaError
        const strictRegistry = new SchemaRegistry({
          'enableStrictGraph': true,
          'logger': new Logger()
        });

        assert.throws(
          () => {
            strictRegistry.register(InvalidInlineSchema);
          },
          (err: unknown) => {
            const schemaErr = err as { 'code'?: string };

            return typeof schemaErr.code === 'string' && schemaErr.code === 'SCHEMA_STRUCTURE_INVALID';
          }
        );

        assert.equal(strictRegistry.get(InvalidInlineSchema.$id), undefined);
        assert.equal(strictRegistry.graph(InvalidInlineSchema.$id), undefined);
        assert.deepEqual(strictRegistry.list(), []);
        assert.deepEqual(strictRegistry.listGraphs(), []);
        assert.throws(() => {
          strictRegistry.validate(InvalidInlineSchema.$id, {});
        }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
        assert.throws(() => {
          strictRegistry.coerce(InvalidInlineSchema.$id, {});
        }, /SCHEMA_NOT_REGISTERED|Schema not registered/u);
      },
      'name': 'inline schema: silent by default, throws with enableStrictGraph',
      'setup': () => {
        // no setup needed
      }
    },
    {
      'check': (registry) => {
        const originalGraph = registry.graph(TestSchema.$id);

        assert.ok(originalGraph !== undefined);
        assert.throws(() => {
          registry.register(InvalidOverwriteSchema);
        }, /already registered with different content/u);

        const retrieved = registry.get(TestSchema.$id);

        assert.deepEqual(retrieved, TestSchema);
        assert.strictEqual(registry.graph(TestSchema.$id), originalGraph);
        assert.equal(registry.list().length, 1);
        assert.equal(registry.listGraphs().length, 1);
        assert.deepEqual(registry.validate(TestSchema.$id, { 'name': 'Alice' }), []);
        const parsed = registry.coerce(TestSchema.$id, { 'name': 'Alice' }) as Record<string, unknown>;

        assert.equal(parsed.name, 'Alice');
      },
      'name': 'failed overwrite preserves previously registered valid schema and caches',
      'setup': (registry) => {
        registry.register(TestSchema);
      }
    },
    {
      'check': (registry) => {
        assert.deepEqual(registry.list(), []);
        assert.deepEqual(registry.listGraphs(), []);
      },
      'name': 'registering an empty array is a no-op',
      'setup': (registry) => {
        registry.register([]);
      }
    }
  ];

  for (const {
    check, 'name': scenarioName, setup
  } of registrationScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry({ 'logger': new Logger() });

      setup(registry);
      check(registry);
    });
  }

  // Log-based scenarios need their own mock logger instances
  const logScenarios: Array<{
    'checkLogs': (logs: string[]) => void;
    'name': string;
    'setup': (registry: SchemaRegistry) => void;
  }> = [
    {
      'checkLogs': (logs) => {
        assert.ok(logs.some((log) => {
          return log.includes('identical');
        }));
      },
      'name': 'identical content with different object reference traces "identical"',
      'setup': (registry) => {
        registry.register(TestSchema);
        registry.register({ ...TestSchema });
      }
    },
    {
      'checkLogs': (logs) => {
        assert.ok(logs.some((log) => {
          return log.includes('WARN:') && log.includes('already registered under different ID');
        }));
      },
      'name': 'same content with different $id warns about duplicate',
      'setup': (registry) => {
        registry.register(DuplicateSchema);
        registry.register({
          '$id': 'https://example.io/duplicate-2',
          'properties': { 'value': { 'type': 'string' } },
          'type': 'object'
        });
      }
    }
  ];

  for (const {
    checkLogs, 'name': scenarioName, setup
  } of logScenarios) {
    void it(scenarioName, () => {
      const logs: string[] = [];
      const registry = new SchemaRegistry({ 'logger': mockLogger(logs) });

      setup(registry);
      checkLogs(logs);
    });
  }
});

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

void describe('SchemaRegistry validation', () => {
  const validationScenarios: Array<{
    'data': unknown;
    'errorSubstring'?: string;
    'name': string;
    'schemaId': string;
    'valid': boolean;
  }> = [
    {
      'data': { 'name': 'Alice' },
      'name': 'valid data returns no errors',
      'schemaId': 'https://example.io/test-schema',
      'valid': true
    },
    {
      'data': { 'age': 'not a number' },
      'errorSubstring': 'name',
      'name': 'missing required field returns errors mentioning field name',
      'schemaId': 'https://example.io/test-schema',
      'valid': false
    },
    {
      'data': {
        'age': 30,
        'name': 'Bob'
      },
      'name': 'valid data with optional field present',
      'schemaId': 'https://example.io/test-schema',
      'valid': true
    },
    {
      'data': {
        'age': 'not-a-number',
        'name': 'Carol'
      },
      'name': 'wrong type for optional field returns errors',
      'schemaId': 'https://example.io/test-schema',
      'valid': false
    }
  ];

  for (const {
    data, errorSubstring, 'name': scenarioName, schemaId, valid
  } of validationScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry({ 'logger': new Logger() });

      registry.register(TestSchema);
      registry.register(TestSchemaWithDefs);

      const errors = registry.validate(schemaId, data);

      if (valid) {
        assert.strictEqual(errors.length, 0);
      } else {
        assert.ok(errors.length > 0);
        if (errorSubstring !== undefined) {
          assert.ok(errors.some((err) => {
            return err.includes(errorSubstring);
          }));
        }
      }
    });
  }

  void it('unregistered schema throws SchemaError from validate()', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    assert.throws(() => {
      registry.validate('https://example.io/nonexistent', {});
    }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
  });

  void it('unregistered schema throws SchemaError from errors()', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    assert.throws(() => {
      registry.errors('https://example.io/nonexistent', {});
    }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
  });

  void it('validates at JSON Pointer', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchemaWithDefs);

    const pointerErrors = registry.validateAt(
      'https://example.io/schema-with-defs',
      '/$defs/Person',
      {
        'email': 'bob@example.io',
        'name': 'Bob'
      }
    );

    assert.strictEqual(pointerErrors.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

void describe('SchemaRegistry options', () => {
  const optionScenarios: Array<{
    'check': (registry: SchemaRegistry, logs: string[]) => void;
    'name': string;
    'options': Record<string, unknown>;
  }> = [
    {
      'check': (registry) => {
        assert.strictEqual(registry.castTypes, true);
      },
      'name': 'castTypes option sets castTypes property',
      'options': { 'castTypes': true }
    },
    {
      'check': (registry, logs) => {
        registry.register(TestSchema);
        assert.ok(logs.length > 0);
      },
      'name': 'logger option receives registration log messages',
      'options': {}
    },
    {
      'check': (registry) => {
        assert.throws(
          () => {
            return registry.register({
              '$id': 'https://example.io/old-dialect',
              '$schema': 'http://json-schema.org/draft-07/schema#',
              'type': 'object'
            });
          },
          (err: Error) => {
            return err.message.includes('Strict mode requires draft 2020-12');
          }
        );
      },
      'name': 'strict mode rejects non-2020-12 dialect',
      'options': { 'strict': true }
    },
    {
      'check': (registry) => {
        assert.doesNotThrow(() => {
          return registry.register(TestSchema);
        });
      },
      'name': 'strict mode accepts 2020-12 schema',
      'options': { 'strict': true }
    },
    {
      'check': (registry) => {
        assert.ok(!registry.castTypes);
      },
      'name': 'default options leave castTypes falsy',
      'options': {}
    }
  ];

  for (const {
    check, 'name': scenarioName, options
  } of optionScenarios) {
    void it(scenarioName, () => {
      const logs: string[] = [];
      const registry = new SchemaRegistry({
        'logger': mockLogger(logs),
        ...options
      });

      check(registry, logs);
    });
  }
});

// ---------------------------------------------------------------------------
// coerce / is / errors
// ---------------------------------------------------------------------------

const ParseTestSchema = {
  '$id': 'https://example.io/parse-test',
  'properties': {
    'count': {
      'default': 0,
      'type': 'number'
    },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

void describe('coerce / is / errors', () => {
  const coerceScenarios: Array<{
    'check': (registry: SchemaRegistry, data: unknown) => void;
    'data': unknown;
    'name': string;
  }> = [
    {
      'check': (registry) => {
        const result = registry.coerce(ParseTestSchema, { 'name': 'Alice' }) as Record<string, unknown>;

        assert.strictEqual(result.name, 'Alice');
        assert.strictEqual(result.count, 0);
      },
      'data': { 'name': 'Alice' },
      'name': 'coerce() returns data with defaults applied'
    },
    {
      'check': (registry) => {
        const original = { 'name': 'Bob' };

        registry.coerce(ParseTestSchema, original);
        assert.strictEqual('count' in original, false);
      },
      'data': { 'name': 'Bob' },
      'name': 'coerce() does not mutate the original object'
    },
    {
      'check': (registry) => {
        assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Frank' }), true);
        assert.ok(registry.get(ParseTestSchema.$id) !== undefined);
      },
      'data': { 'name': 'Frank' },
      'name': 'coerce() requires explicit register() call — is() works after register'
    },
    {
      'check': (registry) => {
        assert.throws(
          () => {
            return registry.coerce(ParseTestSchema, { 'count': 5 });
          },
          (err: unknown) => {
            return err instanceof CoercionError;
          }
        );
      },
      'data': { 'count': 5 },
      'name': 'coerce() throws CoercionError on invalid data'
    },
    {
      'check': (registry) => {
        try {
          registry.coerce(ParseTestSchema, {});
          assert.fail('should have thrown');
        } catch (error) {
          assert.ok(error instanceof CoercionError);
          assert.ok(error.errors.length > 0);
          assert.ok(typeof error.errors.items[0].path === 'string');
          assert.ok(typeof error.errors.items[0].keyword === 'string');
          assert.ok(typeof error.errors.items[0].message === 'string');
        }
      },
      'data': {},
      'name': 'CoercionError has structured errors array with path, keyword, message'
    },
    {
      'check': (registry) => {
        assert.throws(
          () => {
            return registry.coerce(ParseTestSchema, 'not-an-object');
          },
          (err: unknown) => {
            return err instanceof CoercionError;
          }
        );
      },
      'data': 'not-an-object',
      'name': 'coerce() with completely wrong type throws CoercionError'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of coerceScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry({ 'logger': new Logger() });

      registry.register(ParseTestSchema);
      check(registry);
    });
  }

  const isScenarios: Array<{
    'data': unknown;
    'expected': boolean;
    'name': string;
  }> = [
    {
      'data': { 'name': 'Dave' },
      'expected': true,
      'name': 'is() returns true for valid data'
    },
    {
      'data': { 'count': 1 },
      'expected': false,
      'name': 'is() returns false for invalid data (missing required)'
    },
    {
      'data': null,
      'expected': false,
      'name': 'is() returns false for null'
    },
    {
      'data': 42,
      'expected': false,
      'name': 'is() returns false for a non-object primitive'
    }
  ];

  for (const {
    data, expected, 'name': scenarioName
  } of isScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry({ 'logger': new Logger() });

      registry.register(ParseTestSchema);
      assert.strictEqual(registry.is(ParseTestSchema, data), expected);
    });
  }

  const errorsScenarios: Array<{
    'data': unknown;
    'name': string;
    'valid': boolean;
  }> = [
    {
      'data': { 'count': 99 },
      'name': 'errors() returns ValidationErrors for invalid data',
      'valid': false
    },
    {
      'data': { 'name': 'Eve' },
      'name': 'errors() returns empty for valid data',
      'valid': true
    }
  ];

  for (const {
    data, 'name': scenarioName, valid
  } of errorsScenarios) {
    void it(scenarioName, () => {
      const registry = new SchemaRegistry({ 'logger': new Logger() });

      registry.register(ParseTestSchema);

      const errs = registry.errors(ParseTestSchema.$id, data);

      if (valid) {
        assert.equal(errs.length, 0);
      } else {
        assert.ok(errs.length > 0);
        assert.ok(typeof errs.items[0].path === 'string');
        assert.ok(typeof errs.items[0].keyword === 'string');
        assert.ok(typeof errs.items[0].params === 'object');
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Structure Validation
// ---------------------------------------------------------------------------

void describe('Structure Validation', () => {
  const structureScenarios: Array<{
    'expectedWarnings': number;
    'name': string;
    'paths'?: string[];
    'schema': Record<string, unknown>;
  }> = [
    {
      'expectedWarnings': 1,
      'name': 'inline object without $id or $ref produces warning',
      'paths': ['/properties/address'],
      'schema': {
        '$id': 'https://sv.test/1',
        'properties': {
          'address': {
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      }
    },
    {
      'expectedWarnings': 0,
      'name': '$ref property is exempt from inline warning',
      'schema': {
        '$id': 'https://sv.test/2',
        'properties': {
          'address': { '$ref': 'https://example.io/Address' },
          'name': { 'type': 'string' }
        },
        'type': 'object'
      }
    },
    {
      'expectedWarnings': 0,
      'name': '$defs with internal $ref is exempt',
      'schema': {
        '$defs': {
          'Address': {
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          }
        },
        '$id': 'https://sv.test/3',
        'properties': { 'address': { '$ref': '#/$defs/Address' } },
        'type': 'object'
      }
    },
    {
      'expectedWarnings': 0,
      'name': 'bare type:object property without nested properties is exempt',
      'schema': {
        '$id': 'https://sv.test/4',
        'properties': { 'metadata': { 'type': 'object' } },
        'type': 'object'
      }
    },
    {
      'expectedWarnings': 2,
      'name': 'deeply nested inline objects produce multiple warnings',
      'paths': [
        '/properties/address',
        '/properties/address/properties/city'
      ],
      'schema': {
        '$id': 'https://sv.test/5',
        'properties': {
          'address': {
            'properties': {
              'city': {
                'properties': { 'name': { 'type': 'string' } },
                'type': 'object'
              }
            },
            'type': 'object'
          }
        },
        'type': 'object'
      }
    },
    {
      'expectedWarnings': 1,
      'name': 'inline object in array items produces warning',
      'paths': ['/properties/users/items'],
      'schema': {
        '$id': 'https://sv.test/6',
        'properties': {
          'users': {
            'items': {
              'properties': { 'name': { 'type': 'string' } },
              'type': 'object'
            },
            'type': 'array'
          }
        },
        'type': 'object'
      }
    },
    {
      'expectedWarnings': 0,
      'name': 'inline object with its own $id is exempt',
      'schema': {
        '$id': 'https://sv.test/7',
        'properties': {
          'address': {
            '$id': 'https://example.io/Address',
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          }
        },
        'type': 'object'
      }
    }
  ];

  for (const {
    expectedWarnings, 'name': scenarioName, paths, schema
  } of structureScenarios) {
    void it(scenarioName, () => {
      const graph = new SchemaGraph(schema);
      const warnings = graph.validateStructure();

      assert.equal(warnings.length, expectedWarnings);
      if (paths) {
        for (const path of paths) {
          assert.ok(warnings.some((warning) => {
            return warning.path === path;
          }));
        }
      }
    });
  }

  const miscScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const registry = new SchemaRegistry({
          'castTypes': true,
          'logger': new Logger()
        });

        registry.register(TestSchema);
        const converted = registry.convert(TestSchema.$id, {
          'age': '25',
          'name': 'Alice'
        }) as Record<string, unknown>;

        assert.equal(converted.age, 25);
        assert.equal(typeof converted.age, 'number');
      },
      'name': 'convert() coerces string to number without applying defaults'
    },
    {
      'check': () => {
        const registry = new SchemaRegistry({ 'logger': new Logger() });

        registry.register(TestSchema);
        assert.throws(
          () => {
            return registry.validator('https://example.io/nonexistent');
          },
          (err: Error) => {
            return err.message.includes('No schema registered');
          }
        );
      },
      'name': 'validator() throws for unregistered schema'
    },
    {
      'check': () => {
        const registry = new SchemaRegistry({ 'logger': new Logger() });

        registry.register(TestSchema);
        const validator = registry.validator(TestSchema.$id);

        assert.ok(typeof validator.validate === 'function');
      },
      'name': 'validator() returns compiled validator for registered schema'
    },
    {
      'check': () => {
        const registry = new SchemaRegistry({ 'logger': new Logger() });

        assert.throws(
          () => {
            return registry.register({
              '$defs': {
                'A': {
                  '$anchor': 'dup',
                  'type': 'string'
                },
                'B': {
                  '$anchor': 'dup',
                  'type': 'number'
                }
              },
              '$id': 'https://example.io/dup-anchor',
              'type': 'object'
            });
          },
          (err: Error) => {
            return err.message.includes('Duplicate $anchor');
          }
        );
      },
      'name': 'duplicate $anchor detection throws SCHEMA_DUPLICATE_ANCHOR'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of miscScenarios) {
    void it(scenarioName, () => {
      check();
    });
  }
});
