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

void describe('SchemaRegistry', () => {
  void it('registers schemas: single, array, and mixed', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    // single registration
    registry.register(TestSchema);
    const retrieved = registry.get('https://example.io/test-schema');

    assert.ok(retrieved);
    assert.deepStrictEqual(retrieved, TestSchema);

    // array registration
    const registry2 = new SchemaRegistry({ 'logger': new Logger() });

    registry2.register([
      TestSchema,
      TestSchemaWithDefs
    ]);
    assert.ok(registry2.get('https://example.io/test-schema'));
    assert.ok(registry2.get('https://example.io/schema-with-defs'));

    // mixed single then array
    const registry3 = new SchemaRegistry({ 'logger': new Logger() });

    registry3.register(TestSchema);
    registry3.register([TestSchemaWithDefs]);
    assert.ok(registry3.get('https://example.io/test-schema'));
    assert.ok(registry3.get('https://example.io/schema-with-defs'));
  });

  void it('handles idempotent and duplicate registrations', () => {
    // idempotent: identical schema object registered twice
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);
    registry.register(TestSchema);
    const retrieved = registry.get('https://example.io/test-schema');

    assert.ok(retrieved);

    // identical content, different object reference — traces "identical"
    const logs: string[] = [];
    const registry2 = new SchemaRegistry({ 'logger': mockLogger(logs) });

    registry2.register(TestSchema);
    registry2.register({ ...TestSchema });
    assert.ok(logs.some((log) => {
      return log.includes('identical');
    }));

    // same content, different $id — warns about duplicate
    const logs2: string[] = [];
    const registry3 = new SchemaRegistry({ 'logger': mockLogger(logs2) });

    registry3.register(DuplicateSchema);
    registry3.register({
      '$id': 'https://example.io/duplicate-2',
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    });
    assert.ok(logs2.some((log) => {
      return log.includes('WARN:') && log.includes('already registered under different ID');
    }));
  });

  void it('validates data: valid, invalid, at pointer, and unregistered', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);
    registry.register(TestSchemaWithDefs);

    // valid data
    const validErrors = registry.validate('https://example.io/test-schema', { 'name': 'Alice' });

    assert.strictEqual(validErrors.length, 0);

    // invalid data — missing required 'name'
    const invalidErrors = registry.validate('https://example.io/test-schema', { 'age': 'not a number' });

    assert.ok(invalidErrors.length > 0);
    assert.ok(invalidErrors.some((err) => {
      return err.includes('name');
    }));

    // validate at JSON Pointer
    const pointerErrors = registry.validateAt(
      'https://example.io/schema-with-defs',
      '/$defs/Person',
      {
        'email': 'bob@example.io',
        'name': 'Bob'
      }
    );

    assert.strictEqual(pointerErrors.length, 0);

    // unregistered schema
    const missingErrors = registry.validate('https://example.io/nonexistent', {});

    assert.ok(missingErrors.length > 0);
    assert.ok(missingErrors[0].includes('No validator registered'));
  });

  void it('accepts constructor options: castTypes and logger', () => {
    // castTypes option
    const registry = new SchemaRegistry({ 'castTypes': true });

    assert.strictEqual(registry.castTypes, true);

    // logger option
    const logs: string[] = [];
    const registry2 = new SchemaRegistry({ 'logger': mockLogger(logs) });

    registry2.register(TestSchema);
    assert.ok(logs.length > 0);
  });

  void it('throws when schema has no $id', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });
    const schemaNoId: Record<string, unknown> = { 'type': 'object' };

    assert.throws(
      () => {
        registry.register(schemaNoId);
      },
      (err: Error) => {
        return err.message.includes('Schema must have a $id property');
      }
    );
  });

  void it('caches canonical graphs per registered schema', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register([
      TestSchema,
      TestSchemaWithDefs
    ]);

    const first = registry.graph(TestSchema.$id);
    const second = registry.graph(TestSchema.$id);
    const listed = registry.listGraphs();

    assert.ok(first);
    assert.strictEqual(first, second);
    assert.ok(listed.includes(first));
  });

  void it('failed registration is a no-op for empty registry state', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    assert.throws(() => {
      registry.register(InvalidInlineSchema);
    }, /SCHEMA_STRUCTURE_INVALID|Structure validation failed/u);

    assert.equal(registry.get(InvalidInlineSchema.$id), undefined);
    assert.equal(registry.graph(InvalidInlineSchema.$id), undefined);
    assert.deepEqual(registry.list(), []);
    assert.deepEqual(registry.listGraphs(), []);
    assert.ok(registry.validate(InvalidInlineSchema.$id, {}).some((message) => {
      return message.includes('No validator registered');
    }));
    assert.throws(() => {
      registry.coerce(InvalidInlineSchema.$id, {});
    }, /SCHEMA_NOT_REGISTERED|Schema not registered/u);
  });

  void it('failed overwrite preserves the previously registered valid schema and caches', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);
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
  });
});

import { CoercionError } from '../../src/errors/CoercionError.js';

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
  void it('coerce() returns defaults, does not mutate, and requires register()', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);

    // returns data with defaults applied
    const result = registry.coerce(ParseTestSchema, { 'name': 'Alice' }) as Record<string, unknown>;

    assert.strictEqual(result.name, 'Alice');
    assert.strictEqual(result.count, 0);

    // does not mutate the original object
    const original = { 'name': 'Bob' };

    registry.coerce(ParseTestSchema, original);
    assert.strictEqual('count' in original, false);

    // requires explicit register() call
    assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Frank' }), true);
    assert.ok(registry.get(ParseTestSchema.$id) !== undefined);
  });

  void it('coerce() throws CoercionError with structured errors array', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);

    // throws CoercionError on invalid data
    assert.throws(
      () => {
        return registry.coerce(ParseTestSchema, { 'count': 5 });
      },
      (err: unknown) => {
        return err instanceof CoercionError;
      }
    );

    // CoercionError has structured errors array
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
  });

  void it('is() returns true for valid data, false for invalid', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Dave' }), true);
    assert.strictEqual(registry.is(ParseTestSchema, { 'count': 1 }), false);
  });

  void it('errors() returns ValidationErrors for invalid data, empty for valid', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);

    // invalid data
    const errs = registry.errors(ParseTestSchema.$id, { 'count': 99 });

    assert.ok(errs.length > 0);
    assert.ok(typeof errs.items[0].path === 'string');
    assert.ok(typeof errs.items[0].keyword === 'string');
    assert.ok(typeof errs.items[0].params === 'object');

    // valid data
    assert.equal(registry.errors(ParseTestSchema.$id, { 'name': 'Eve' }).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Structure Validation (folded from structureValidation.test.ts)
// ---------------------------------------------------------------------------

void describe('Structure Validation', () => {
  void it('detects inline objects and respects exemptions', () => {
    const scenarios: Array<{ 'expectedWarnings': number;
      'paths'?: string[];
      'schema': Record<string, unknown> }> = [
      {
        'expectedWarnings': 1,
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
        'schema': {
          '$id': 'https://sv.test/4',
          'properties': { 'metadata': { 'type': 'object' } },
          'type': 'object'
        }
      },
      {
        'expectedWarnings': 2,
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
      expectedWarnings, paths, schema
    } of scenarios) {
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
    }
  });

  void it('convert() coerces types without applying defaults, validator() throws for missing schema, strict mode rejects non-2020-12', () => {
    // convert(): coerces string→number without applying defaults
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

    // validator(): throws for unregistered schema
    assert.throws(
      () => {
        return registry.validator('https://example.io/nonexistent');
      },
      (err: Error) => {
        return err.message.includes('No schema registered');
      }
    );

    // validator(): returns compiled validator for registered schema
    const validator = registry.validator(TestSchema.$id);

    assert.ok(typeof validator.validate === 'function');

    // strict mode: rejects non-2020-12 dialect
    const strictRegistry = new SchemaRegistry({
      'logger': new Logger(),
      'strict': true
    });

    assert.throws(
      () => {
        return strictRegistry.register({
          '$id': 'https://example.io/old-dialect',
          '$schema': 'http://json-schema.org/draft-07/schema#',
          'type': 'object'
        });
      },
      (err: Error) => {
        return err.message.includes('Strict mode requires draft 2020-12');
      }
    );

    // strict mode: accepts 2020-12 schema
    assert.doesNotThrow(() => {
      return strictRegistry.register(TestSchema);
    });
  });

  void it('duplicate $anchor detection throws SCHEMA_DUPLICATE_ANCHOR', () => {
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
  });

  void it('registration succeeds with proper $ref patterns', () => {
    const registry = new SchemaRegistry();

    assert.doesNotThrow(() => {
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
    });
  });
});
