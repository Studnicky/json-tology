/**
 * Schema Registry Tests
 */

import {
  describe, it
} from 'node:test';
import * as assert from 'node:assert';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Logger } from '../../src/modules/logger/Logger.js';

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

describe('SchemaRegistry', () => {
  it('should register a single schema by $id', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);

    const retrieved = registry.get('https://example.io/test-schema');

    assert.ok(retrieved);
    assert.deepStrictEqual(retrieved, TestSchema);
  });

  it('should throw if schema has no $id', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });
    const schemaNoId = { 'type': 'object' } as Record<string, unknown>;

    assert.throws(
      () => {
        registry.register(schemaNoId);
      },
      (err: Error) => {
        return err.message.includes('Schema must have a $id property');
      }
    );
  });

  it('should register multiple schemas at once (array)', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });
    const schemas = [
      TestSchema,
      TestSchemaWithDefs
    ];

    registry.register(schemas);

    assert.ok(registry.get('https://example.io/test-schema'));
    assert.ok(registry.get('https://example.io/schema-with-defs'));
  });

  it('should be idempotent when registering identical schema twice', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);
    registry.register(TestSchema); // Should not throw

    const retrieved = registry.get('https://example.io/test-schema');

    assert.ok(retrieved);
  });

  it('should detect identical schemas and skip registration idempotently', () => {
    const logs: string[] = [];
    const mockLogger = {
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

    const registry = new SchemaRegistry({ 'logger': mockLogger });

    registry.register(TestSchema);
    registry.register({ ...TestSchema }); // Register different object with same content

    // Should have a trace message about identical schema
    assert.ok(logs.some((log) => {
      return log.includes('identical');
    }));
  });

  it('should warn when registering duplicate schema with different ID', () => {
    const logs: string[] = [];
    const mockLogger = {
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

    const registry = new SchemaRegistry({ 'logger': mockLogger });

    registry.register(DuplicateSchema);

    const sameContentDifferentId = {
      '$id': 'https://example.io/duplicate-2',
      'properties': { 'value': { 'type': 'string' } },
      'type': 'object'
    };

    registry.register(sameContentDifferentId);

    assert.ok(logs.some((log) => {
      return log.includes('WARN:') && log.includes('already registered under different ID');
    }));
  });

  it('should validate data against a schema', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);

    const validData = { 'name': 'Alice' };
    const errors = registry.validate('https://example.io/test-schema', validData);

    assert.strictEqual(errors.length, 0);
  });

  it('should return errors for invalid data', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);

    const invalidData = { 'age': 'not a number' }; // Missing required 'name'
    const errors = registry.validate('https://example.io/test-schema', invalidData);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => {
      return err.includes('name');
    }));
  });

  it('should validate data at a JSON Pointer', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchemaWithDefs);

    const personData = {
      'email': 'bob@example.io',
      'name': 'Bob'
    };
    const errors = registry.validateAt(
      'https://example.io/schema-with-defs',
      '/$defs/Person',
      personData
    );

    assert.strictEqual(errors.length, 0);
  });

  it('should return error for unregistered schema', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    const errors = registry.validate('https://example.io/nonexistent', {});

    assert.ok(errors.length > 0);
    assert.ok(errors[0].includes('No validator registered'));
  });

  it('should accept coerce option in constructor', () => {
    const registry = new SchemaRegistry({ 'coerce': true });

    assert.strictEqual(registry.coerce, true);
  });

  it('should accept logger in constructor', () => {
    const logs: string[] = [];
    const registry = new SchemaRegistry({
      'logger': {
        'debug': (msg) => {
          return logs.push(msg);
        },
        'error': (msg) => {
          return logs.push(msg);
        },
        'fatal': (msg) => {
          return logs.push(msg);
        },
        'info': (msg) => {
          return logs.push(msg);
        },
        'trace': (msg) => {
          return logs.push(msg);
        },
        'warn': (msg) => {
          return logs.push(msg);
        }
      }
    });

    registry.register(TestSchema);

    assert.ok(logs.length > 0);
  });

  it('should handle mixed single and array registrations', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(TestSchema);
    registry.register([TestSchemaWithDefs]);

    assert.ok(registry.get('https://example.io/test-schema'));
    assert.ok(registry.get('https://example.io/schema-with-defs'));
  });

  it('caches canonical graphs per registered schema', () => {
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
});

import { ParseError } from '../../src/errors/ParseError.js';

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

describe('parse / is / errors', () => {
  it('parse() returns data with defaults applied', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    const result = registry.parse(ParseTestSchema, { 'name': 'Alice' }) as any;

    assert.strictEqual(result.name, 'Alice');
    assert.strictEqual(result.count, 0);
  });

  it('parse() does not mutate the original object', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    const original = { 'name': 'Bob' };

    registry.parse(ParseTestSchema, original);
    assert.strictEqual('count' in original, false);
  });

  it('parse() throws ParseError on invalid data', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    assert.throws(
      () => {
        return registry.parse(ParseTestSchema, { 'count': 5 });
      },
      (err: unknown) => {
        return err instanceof ParseError;
      }
    );
  });

  it('parse() ParseError has structured errors array', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    try {
      registry.parse(ParseTestSchema, {});
      assert.fail('should have thrown');
    } catch (error) {
      assert.ok(error instanceof ParseError);
      assert.ok(error.errors.length > 0);
      assert.ok(typeof error.errors.items[0].path === 'string');
      assert.ok(typeof error.errors.items[0].keyword === 'string');
      assert.ok(typeof error.errors.items[0].message === 'string');
    }
  });

  it('is() returns true for valid data', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Dave' }), true);
  });

  it('is() returns false for invalid data', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    assert.strictEqual(registry.is(ParseTestSchema, { 'count': 1 }), false);
  });

  it('errors() returns ValidationErrors with items for invalid data', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    const errs = registry.errors(ParseTestSchema.$id, { 'count': 99 });

    assert.ok(errs.length > 0);
    assert.ok(typeof errs.items[0].path === 'string');
    assert.ok(typeof errs.items[0].keyword === 'string');
    assert.ok(typeof errs.items[0].params === 'object');
  });

  it('errors() returns empty ValidationErrors for valid data', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    assert.equal(registry.errors(ParseTestSchema.$id, { 'name': 'Eve' }).length, 0);
  });

  it('parse() / is() require explicit register() call', () => {
    const registry = new SchemaRegistry({ 'logger': new Logger() });

    registry.register(ParseTestSchema);
    assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Frank' }), true);
    assert.ok(registry.get(ParseTestSchema.$id) !== undefined);
  });
});
