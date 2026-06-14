/**
 * Schema Registry Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  InstantiationError, JsonTology
} from '../../src/index.js';
// SchemaRegistryInterface is the registration contract underlying JsonTology; not surfaced publicly.
import type { SchemaRegistryInterface } from '../../src/interfaces/SchemaRegistry.js';
import { Logger } from '../utils/Logger.js';
// SchemaGraph is consumed directly to assert graph-construction details that JsonTology composes internally.
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';

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
    'check': (registry: SchemaRegistryInterface) => void;
    'name': string;
    'setup': (registry: SchemaRegistryInterface) => void;
  }> = [
    {
      'check': (registry) => {
        const retrieved = registry.get('https://example.io/test-schema');

        assert.deepStrictEqual(retrieved, TestSchema);
      },
      'name': 'registers a single schema and retrieves it by $id',
      'setup': (registry) => {
        registry.set(TestSchema);
      }
    },
    {
      'check': (registry) => {
        assert.deepStrictEqual(registry.get('https://example.io/test-schema'), TestSchema);
        assert.deepStrictEqual(registry.get('https://example.io/schema-with-defs'), TestSchemaWithDefs);
      },
      'name': 'registers an array of schemas',
      'setup': (registry) => {
        registry.set([
          TestSchema,
          TestSchemaWithDefs
        ]);
      }
    },
    {
      'check': (registry) => {
        assert.deepStrictEqual(registry.get('https://example.io/test-schema'), TestSchema);
        assert.deepStrictEqual(registry.get('https://example.io/schema-with-defs'), TestSchemaWithDefs);
      },
      'name': 'registers single then array (mixed)',
      'setup': (registry) => {
        registry.set(TestSchema);
        registry.set([TestSchemaWithDefs]);
      }
    },
    {
      'check': (registry) => {
        assert.deepStrictEqual(registry.get('https://example.io/test-schema'), TestSchema);
        assert.equal(registry.list().length, 1);
      },
      'name': 'idempotent: identical schema object registered twice',
      'setup': (registry) => {
        registry.set(TestSchema);
        registry.set(TestSchema);
      }
    },
    {
      'check': (registry) => {
        const first = registry.graph(TestSchema.$id);
        const second = registry.graph(TestSchema.$id);
        const listed = registry.listGraphs();

        assert.ok(first !== undefined);
        assert.strictEqual(first, second);
        assert.equal(listed.includes(first), true);
        assert.equal(listed.length, 2);
      },
      'name': 'caches canonical graphs per registered schema',
      'setup': (registry) => {
        registry.set([
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
            registry.set(schemaNoId);
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
        const address = registry.get('https://example.io/Address') as Record<string, unknown>;
        const user = registry.get('https://example.io/User') as Record<string, unknown>;

        assert.equal(address.$id, 'https://example.io/Address');
        assert.equal(user.$id, 'https://example.io/User');
        assert.deepStrictEqual(
          (user.properties as Record<string, unknown>).address,
          { '$ref': 'https://example.io/Address' }
        );
      },
      'name': 'registration succeeds with proper $ref patterns',
      'setup': (registry) => {
        registry.set([
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
        // Default (strict) mode: inline schemas throw SchemaError
        const strictRegistry = JsonTology.create({
          'baseIRI': 'https://example.io',
          'logger': new Logger()
        }).registry;

        assert.throws(
          () => {
            strictRegistry.set(InvalidInlineSchema);
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
          strictRegistry.instantiate(InvalidInlineSchema.$id, {});
        }, /SCHEMA_NOT_REGISTERED|Schema not registered/u);

        // Permissive mode (enableStrictGraph: false): inline schemas register silently
        const permissiveRegistry = JsonTology.create({
          'baseIRI': 'https://example.io',
          'enableStrictGraph': false,
          'logger': new Logger()
        }).registry;

        assert.doesNotThrow(() => {
          permissiveRegistry.set(InvalidInlineSchema);
        });
        assert.deepStrictEqual(permissiveRegistry.get(InvalidInlineSchema.$id), InvalidInlineSchema);
      },
      'name': 'inline schema: throws by default (strict), silent with enableStrictGraph: false',
      'setup': () => {
        // no setup needed
      }
    },
    {
      'check': (registry) => {
        const originalGraph = registry.graph(TestSchema.$id);

        assert.notStrictEqual(originalGraph, undefined);
        registry.set(InvalidOverwriteSchema);

        const retrieved = registry.get(TestSchema.$id);

        assert.deepEqual(retrieved, InvalidOverwriteSchema);
        assert.notStrictEqual(registry.graph(TestSchema.$id), originalGraph);
        assert.equal(registry.list().length, 1);
        assert.equal(registry.listGraphs().length, 1);
      },
      'name': 'set() replaces an existing entry with new content (Map semantics)',
      'setup': (registry) => {
        registry.set(TestSchema);
      }
    },
    {
      'check': (registry) => {
        assert.deepEqual(registry.list(), []);
        assert.deepEqual(registry.listGraphs(), []);
      },
      'name': 'registering an empty array is a no-op',
      'setup': (registry) => {
        registry.set([]);
      }
    }
  ];

  for (const {
    check, 'name': scenarioName, setup
  } of registrationScenarios) {
    void it(scenarioName, () => {
      // enableStrictGraph: false — some scenarios register schemas with inline
      // nested objects to test Map-replacement semantics.
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'enableStrictGraph': false,
        'logger': new Logger()
      }).registry;

      setup(registry);
      check(registry);
    });
  }

  // Log-based scenarios need their own mock logger instances
  const logScenarios: Array<{
    'checkLogs': (logs: string[]) => void;
    'name': string;
    'setup': (registry: SchemaRegistryInterface) => void;
  }> = [
    {
      'checkLogs': (logs) => {
        const errorLog = logs.find((log) => {
          return log.includes('ERROR:') || log.includes('SCHEMA_DUPLICATE_ID');
        });

        assert.strictEqual(errorLog, undefined, 'identical content replaces silently — no error');
      },
      'name': 'set() with identical content replaces silently (Map semantics)',
      'setup': (registry) => {
        registry.set(TestSchema);
        registry.set({ ...TestSchema });
      }
    },
    {
      'checkLogs': (logs) => {
        const warnLog = logs.find((log) => {
          return log.includes('WARN:') && log.includes('already registered under different ID');
        });

        assert.notStrictEqual(warnLog, undefined);
        assert.match(warnLog as string, /WARN:.*already registered under different ID/u);
      },
      'name': 'same content with different $id warns about duplicate',
      'setup': (registry) => {
        registry.set(DuplicateSchema);
        registry.set({
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
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'logger': mockLogger(logs)
      }).registry;

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
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'logger': new Logger()
      }).registry;

      registry.set(TestSchema);
      registry.set(TestSchemaWithDefs);

      const errors = registry.validate(schemaId, data);

      if (valid) {
        assert.strictEqual(errors.length, 0);
      } else {
        assert.equal(errors.length > 0, true);
        if (errorSubstring !== undefined) {
          const matched = errors.items.find((err) => {
            return err.message.includes(errorSubstring);
          });

          assert.notStrictEqual(matched, undefined);
          assert.match((matched as { 'message': string }).message, new RegExp(errorSubstring, 'u'));
        }
      }
    });
  }

  void it('unregistered schema throws SchemaError from validate()', () => {
    const registry = JsonTology.create({
      'baseIRI': 'https://example.io',
      'logger': new Logger()
    }).registry;

    assert.throws(() => {
      registry.validate('https://example.io/nonexistent', {});
    }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
  });

  void it('unregistered schema throws SchemaError from validate() (renamed)', () => {
    const registry = JsonTology.create({
      'baseIRI': 'https://example.io',
      'logger': new Logger()
    }).registry;

    assert.throws(() => {
      registry.validate('https://example.io/nonexistent', {});
    }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
  });

  void it('validates at JSON Pointer', () => {
    const registry = JsonTology.create({
      'baseIRI': 'https://example.io',
      'logger': new Logger()
    }).registry;

    registry.set(TestSchemaWithDefs);

    const subSchema = registry.subschemaAt(
      'https://example.io/schema-with-defs',
      '/$defs/Person'
    );
    const person = registry.validate(subSchema, {
      'email': 'bob@example.io',
      'name': 'Bob'
    });

    assert.strictEqual(person.items.length, 0);
  });
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

void describe('SchemaRegistry options', () => {
  const optionScenarios: Array<{
    'check': (registry: SchemaRegistryInterface, logs: string[]) => void;
    'name': string;
    'options': Record<string, unknown>;
  }> = [
    {
      'check': (registry) => {
        assert.strictEqual(registry.castTypes, true);
      },
      'name': 'enableTypeCast option sets castTypes property',
      'options': { 'enableTypeCast': true }
    },
    {
      'check': (registry, logs) => {
        const before = logs.length;

        registry.set(TestSchema);
        assert.equal(logs.length > before, true);
      },
      'name': 'logger option receives registration log messages',
      'options': {}
    },
    {
      'check': (registry) => {
        assert.throws(
          () => {
            return registry.set({
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
      'options': { 'enableStrictTypes': true }
    },
    {
      'check': (registry) => {
        assert.doesNotThrow(() => {
          return registry.set(TestSchema);
        });
      },
      'name': 'strict mode accepts 2020-12 schema',
      'options': { 'enableStrictTypes': true }
    },
    {
      'check': (registry) => {
        assert.strictEqual(registry.castTypes, false);
      },
      'name': 'default options leave castTypes false',
      'options': {}
    }
  ];

  for (const {
    check, 'name': scenarioName, options
  } of optionScenarios) {
    void it(scenarioName, () => {
      const logs: string[] = [];
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'logger': mockLogger(logs),
        ...options
      }).registry;

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
    'check': (registry: SchemaRegistryInterface) => void;
    'data': unknown;
    'name': string;
  }> = [
    {
      'check': (registry) => {
        const result = registry.instantiate(ParseTestSchema, { 'name': 'Alice' }) as Record<string, unknown>;

        assert.strictEqual(result.name, 'Alice');
        assert.strictEqual(result.count, 0);
      },
      'data': { 'name': 'Alice' },
      'name': 'coerce() returns data with defaults applied'
    },
    {
      'check': (registry) => {
        const original = { 'name': 'Bob' };

        registry.instantiate(ParseTestSchema, original);
        assert.strictEqual('count' in original, false);
      },
      'data': { 'name': 'Bob' },
      'name': 'coerce() does not mutate the original object'
    },
    {
      'check': (registry) => {
        assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Frank' }), true);
        assert.deepStrictEqual(registry.get(ParseTestSchema.$id), ParseTestSchema);
      },
      'data': { 'name': 'Frank' },
      'name': 'coerce() requires explicit register() call — is() works after register'
    },
    {
      'check': (registry) => {
        assert.throws(
          () => {
            return registry.instantiate(ParseTestSchema, { 'count': 5 });
          },
          (err: unknown) => {
            return err instanceof InstantiationError;
          }
        );
      },
      'data': { 'count': 5 },
      'name': 'coerce() throws InstantiationError on invalid data'
    },
    {
      'check': (registry) => {
        try {
          registry.instantiate(ParseTestSchema, {});
          assert.fail('should have thrown');
        } catch (error) {
          assert.equal(error instanceof InstantiationError, true);
          const ie = error as InstantiationError;

          assert.equal(ie.errors.length > 0, true);
          const first = ie.errors.items[0];

          assert.equal(typeof first.path, 'string');
          assert.equal(typeof first.keyword, 'string');
          assert.equal(typeof first.message, 'string');
          assert.equal(first.keyword, 'required');
          assert.match(first.message, /name|required/u);
        }
      },
      'data': {},
      'name': 'InstantiationError has structured errors array with path, keyword, message'
    },
    {
      'check': (registry) => {
        assert.throws(
          () => {
            return registry.instantiate(ParseTestSchema, 'not-an-object');
          },
          (err: unknown) => {
            return err instanceof InstantiationError;
          }
        );
      },
      'data': 'not-an-object',
      'name': 'coerce() with completely wrong type throws InstantiationError'
    }
  ];

  for (const {
    check, 'name': scenarioName
  } of coerceScenarios) {
    void it(scenarioName, () => {
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'logger': new Logger()
      }).registry;

      registry.set(ParseTestSchema);
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
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'logger': new Logger()
      }).registry;

      registry.set(ParseTestSchema);
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
      const registry = JsonTology.create({
        'baseIRI': 'https://example.io',
        'logger': new Logger()
      }).registry;

      registry.set(ParseTestSchema);

      const errs = registry.validate(ParseTestSchema.$id, data);

      if (valid) {
        assert.equal(errs.length, 0);
      } else {
        assert.equal(errs.length > 0, true);
        const first = errs.items[0];

        assert.equal(typeof first.path, 'string');
        assert.equal(typeof first.keyword, 'string');
        assert.equal(typeof first.params, 'object');
        assert.equal(first.keyword, 'required');
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
        const warningPaths = warnings.map((warning) => {
          return warning.path;
        }).sort();

        assert.deepStrictEqual(warningPaths, [...paths].sort());
      }
    });
  }

  const miscScenarios: Array<{
    'check': () => void;
    'name': string;
  }> = [
    {
      'check': () => {
        const registry = JsonTology.create({
          'baseIRI': 'https://example.io',
          'enableTypeCast': true,
          'logger': new Logger()
        }).registry;

        registry.set(TestSchema);
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
        const registry = JsonTology.create({
          'baseIRI': 'https://example.io',
          'logger': new Logger()
        }).registry;

        registry.set(TestSchema);
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
        const registry = JsonTology.create({
          'baseIRI': 'https://example.io',
          'logger': new Logger()
        }).registry;

        registry.set(TestSchema);
        const validator = registry.validator(TestSchema.$id);

        assert.equal(typeof validator.validate, 'function');
        const result = validator.validate({ 'name': 'Alice' });

        assert.equal(result.valid, true);
        assert.equal(result.errors.length, 0);
      },
      'name': 'validator() returns compiled validator for registered schema'
    },
    {
      'check': () => {
        const registry = JsonTology.create({
          'baseIRI': 'https://example.io',
          'logger': new Logger()
        }).registry;

        assert.throws(
          () => {
            return registry.set({
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

// ---------------------------------------------------------------------------
// Wave C — single-path embedded-$id resolution via graph index
// ---------------------------------------------------------------------------
// Verifies that the sole resolution path (SchemaGraph.embeddedNode) correctly
// resolves $refs to embedded $ids in $defs at the registry engine level,
// through materialize and validate, without any raw-walk fallback.

void describe('embedded-$id single-path resolution via graph index', { 'concurrency': true }, () => {
  void it('registry.instantiate resolves $ref to an embedded $defs $id through the graph index', () => {
    const AddressSchema = {
      '$defs': {
        'Address': {
          '$id': 'https://x.test/Address',
          'properties': {
            'city': { 'type': 'string' },
            'street': { 'type': 'string' }
          },
          'required': ['street'],
          'type': 'object'
        }
      },
      '$id': 'https://x.test/AddressHolder',
      'properties': { 'home': { '$ref': 'https://x.test/Address' } },
      'required': ['home'],
      'type': 'object'
    } as const;

    const registry = JsonTology.create({ 'baseIRI': 'https://x.test' }).registry;

    registry.set(AddressSchema);

    // Valid: home.street is present — instantiate validates and returns the value
    const result = registry.instantiate(AddressSchema, {
      'home': {
        'city': 'Boston',
        'street': '1 Main St'
      }
    });

    assert.deepEqual(result, {
      'home': {
        'city': 'Boston',
        'street': '1 Main St'
      }
    });
  });

  void it('registry validate rejects data that violates the embedded $defs schema', () => {
    const OrderSchema = {
      '$defs': {
        'LineItem': {
          '$id': 'https://x.test/LineItem',
          'properties': {
            'qty': {
              'minimum': 1,
              'type': 'integer'
            },
            'sku': { 'type': 'string' }
          },
          'required': [
            'sku',
            'qty'
          ],
          'type': 'object'
        }
      },
      '$id': 'https://x.test/Order',
      'properties': {
        'items': {
          'items': { '$ref': 'https://x.test/LineItem' },
          'type': 'array'
        }
      },
      'required': ['items'],
      'type': 'object'
    } as const;

    const registry = JsonTology.create({ 'baseIRI': 'https://x.test' }).registry;

    registry.set(OrderSchema);

    // validate() returns ValidationErrors; .length === 0 means valid
    const validErrors = registry.validate(OrderSchema, {
      'items': [{
        'qty': 2,
        'sku': 'ABC-1'
      }]
    });

    assert.equal(validErrors.length, 0, 'valid order should produce zero errors');

    const invalidErrors = registry.validate(OrderSchema, {
      'items': [{
        'qty': 0,
        'sku': 'ABC-1'
      }]
    });

    assert.ok(invalidErrors.length > 0, 'qty below minimum should produce errors');
  });

  void it('graph embeddedNode is the sole mechanism — engine resolves embedded $defs $ref via graph index', () => {
    // Schema A embeds Sub under $defs with its own $id. The $ref to Sub's absolute
    // $id is resolved by GraphEngine exclusively via the root graph's embeddedNode()
    // index — no raw-walk fallback exists after Wave C cleanup.
    // We use registry.engine() to exercise the GraphEngine resolution path directly.
    const SchemaA = {
      '$defs': {
        'Sub': {
          '$id': 'https://x.test/SchemaA/Sub',
          'minimum': 0,
          'type': 'integer'
        }
      },
      '$id': 'https://x.test/SchemaA',
      'properties': { 'val': { '$ref': 'https://x.test/SchemaA/Sub' } },
      'required': ['val'],
      'type': 'object'
    } as const;

    const registry = JsonTology.create({ 'baseIRI': 'https://x.test' }).registry;

    registry.set(SchemaA);

    // Confirm embeddedNode is populated on SchemaA's graph
    const graph = registry.graph('https://x.test/SchemaA');

    assert.notStrictEqual(graph, undefined, 'graph must exist');

    const subNode = graph?.embeddedNode('https://x.test/SchemaA/Sub');

    assert.notStrictEqual(subNode, undefined, 'embeddedNode must find SchemaA/Sub through graph index');

    // Use registry.engine() which routes through GraphEngine.resolveRefGraph —
    // the exact path now backed exclusively by embeddedNode().
    const engine = registry.engine(SchemaA);

    const passResult = engine.execute({ 'val': 5 });

    assert.equal(passResult.valid, true, 'val=5 should pass');

    const failResult = engine.execute({ 'val': -1 });

    assert.equal(failResult.valid, false, 'val=-1 should fail minimum constraint');
    assert.ok(failResult.errors.length > 0, 'should have errors');
  });
});
