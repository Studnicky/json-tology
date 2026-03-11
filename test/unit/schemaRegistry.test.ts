/**
 * Schema Registry Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';
import { ConsoleLogger } from '../../src/ConsoleLogger.js';

const TestSchema = {
  '$id': 'https://example.io/test-schema',
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  'properties': {
    'name': { 'type': 'string' },
    'age': { 'type': 'number' },
  },
  'required': ['name'],
  'type': 'object',
} as const;

const TestSchemaWithDefs = {
  '$id': 'https://example.io/schema-with-defs',
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  '$defs': {
    'Person': {
      'properties': {
        'name': { 'type': 'string' },
        'email': { 'type': 'string' },
      },
      'required': ['name'],
      'type': 'object',
    },
  },
  'properties': {
    'person': { '$ref': '#/$defs/Person' },
  },
  'type': 'object',
} as const;

const DuplicateSchema = {
  '$id': 'https://example.io/duplicate-1',
  'type': 'object',
  'properties': { 'value': { 'type': 'string' } },
};

describe('SchemaRegistry', () => {
  it('should register a single schema by $id', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(TestSchema);

    const retrieved = registry.get('https://example.io/test-schema');
    assert.ok(retrieved);
    assert.deepStrictEqual(retrieved, TestSchema);
  });

  it('should throw if schema has no $id', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    const schemaNoId = { 'type': 'object' } as Record<string, unknown>;

    assert.throws(
      () => {
        registry.register(schemaNoId);
      },
      (err: Error) => err.message.includes('Schema must have a $id property')
    );
  });

  it('should register multiple schemas at once (array)', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    const schemas = [TestSchema, TestSchemaWithDefs];

    registry.register(schemas);

    assert.ok(registry.get('https://example.io/test-schema'));
    assert.ok(registry.get('https://example.io/schema-with-defs'));
  });

  it('should be idempotent when registering identical schema twice', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(TestSchema);
    registry.register(TestSchema); // Should not throw

    const retrieved = registry.get('https://example.io/test-schema');
    assert.ok(retrieved);
  });

  it('should detect identical schemas and skip registration idempotently', () => {
    const logs: string[] = [];
    const mockLogger = {
      trace: (msg: string) => logs.push(msg),
      debug: (msg: string) => logs.push(msg),
      info:  (msg: string) => logs.push(msg),
      warn:  (msg: string) => logs.push(`WARN: ${msg}`),
      error: (msg: string) => logs.push(`ERROR: ${msg}`),
      fatal: (msg: string) => logs.push(`FATAL: ${msg}`),
    };

    const registry = new SchemaRegistry({ logger: mockLogger });
    registry.register(TestSchema);
    registry.register(TestSchema); // Register same schema again

    // Should have a debug message about identical schema
    assert.ok(logs.some((log) => log.includes('identical')));
  });

  it('should warn when registering duplicate schema with different ID', () => {
    const logs: string[] = [];
    const mockLogger = {
      trace: (msg: string) => logs.push(msg),
      debug: (msg: string) => logs.push(msg),
      info:  (msg: string) => logs.push(msg),
      warn:  (msg: string) => logs.push(`WARN: ${msg}`),
      error: (msg: string) => logs.push(`ERROR: ${msg}`),
      fatal: (msg: string) => logs.push(`FATAL: ${msg}`),
    };

    const registry = new SchemaRegistry({ logger: mockLogger });
    registry.register(DuplicateSchema);

    const sameContentDifferentId = {
      '$id': 'https://example.io/duplicate-2',
      'type': 'object',
      'properties': { 'value': { 'type': 'string' } },
    };
    registry.register(sameContentDifferentId);

    assert.ok(
      logs.some(
        (log) =>
          log.includes('WARN:') && log.includes('already registered under different ID')
      )
    );
  });

  it('should validate data against a schema', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(TestSchema);

    const validData = { 'name': 'Alice' };
    const errors = registry.validate('https://example.io/test-schema', validData);

    assert.strictEqual(errors.length, 0);
  });

  it('should return errors for invalid data', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(TestSchema);

    const invalidData = { 'age': 'not a number' }; // Missing required 'name'
    const errors = registry.validate('https://example.io/test-schema', invalidData);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => err.includes('name')));
  });

  it('should validate data at a JSON Pointer', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(TestSchemaWithDefs);

    const personData = { 'name': 'Bob', 'email': 'bob@example.io' };
    const errors = registry.validateAt(
      'https://example.io/schema-with-defs',
      '/$defs/Person',
      personData
    );

    assert.strictEqual(errors.length, 0);
  });

  it('should return error for unregistered schema', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });

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
      logger: {
        trace: (msg) => logs.push(msg),
        debug: (msg) => logs.push(msg),
        info:  (msg) => logs.push(msg),
        warn:  (msg) => logs.push(msg),
        error: (msg) => logs.push(msg),
        fatal: (msg) => logs.push(msg),
      },
    });

    registry.register(TestSchema);

    assert.ok(logs.length > 0);
  });

  it('should handle mixed single and array registrations', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });

    registry.register(TestSchema);
    registry.register([TestSchemaWithDefs]);

    assert.ok(registry.get('https://example.io/test-schema'));
    assert.ok(registry.get('https://example.io/schema-with-defs'));
  });

  it('caches canonical graphs per registered schema', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });

    registry.register([TestSchema, TestSchemaWithDefs]);

    const first = registry.graph(TestSchema.$id);
    const second = registry.graph(TestSchema.$id);
    const listed = registry.listGraphs();

    assert.ok(first);
    assert.strictEqual(first, second);
    assert.ok(listed.includes(first as NonNullable<typeof first>));
  });
});

import { ParseError } from '../../src/schema/ParseError.js';

const ParseTestSchema = {
  '$id': 'https://example.io/parse-test',
  'type': 'object',
  'properties': {
    'name':  { 'type': 'string' },
    'count': { 'type': 'number', 'default': 0 },
  },
  'required': ['name'],
} as const;

describe('parse / safeParse / is / errors', () => {
  it('parse() returns data with defaults applied', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    const result = registry.parse(ParseTestSchema, { 'name': 'Alice' }) as any;
    assert.strictEqual(result.name, 'Alice');
    assert.strictEqual(result.count, 0);
  });

  it('parse() does not mutate the original object', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    const original = { 'name': 'Bob' };
    registry.parse(ParseTestSchema, original);
    assert.strictEqual('count' in original, false);
  });

  it('parse() throws ParseError on invalid data', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    assert.throws(
      () => registry.parse(ParseTestSchema, { 'count': 5 }),
      (err: unknown) => err instanceof ParseError,
    );
  });

  it('parse() ParseError has structured errors array', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    try {
      registry.parse(ParseTestSchema, {});
      assert.fail('should have thrown');
    } catch (err) {
      assert.ok(err instanceof ParseError);
      assert.ok(err.errors.length > 0);
      assert.ok(typeof err.errors.items[0].path === 'string');
      assert.ok(typeof err.errors.items[0].keyword === 'string');
      assert.ok(typeof err.errors.items[0].message === 'string');
    }
  });

  it('safeParse() returns success:true with data on valid input', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    const result = registry.safeParse(ParseTestSchema, { 'name': 'Carol' });
    assert.strictEqual(result.success, true);
    if (result.success) assert.strictEqual((result.data as any).name, 'Carol');
  });

  it('safeParse() returns success:false with errors on invalid input', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    const result = registry.safeParse(ParseTestSchema, { 'count': 99 });
    assert.strictEqual(result.success, false);
    if (!result.success) {
      assert.ok(result.errors.length > 0);
      assert.ok(typeof result.errors.items[0].message === 'string');
    }
  });

  it('is() returns true for valid data', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Dave' }), true);
  });

  it('is() returns false for invalid data', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    assert.strictEqual(registry.is(ParseTestSchema, { 'count': 1 }), false);
  });

  it('errors() returns ValidationErrors with items for invalid data', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(ParseTestSchema);
    const errs = registry.errors(ParseTestSchema.$id, { 'count': 99 });
    assert.ok(errs.length > 0);
    assert.ok(typeof errs.items[0].path === 'string');
    assert.ok(typeof errs.items[0].keyword === 'string');
    assert.ok(typeof errs.items[0].params === 'object');
  });

  it('errors() returns empty ValidationErrors for valid data', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    registry.register(ParseTestSchema);
    assert.equal(registry.errors(ParseTestSchema.$id, { 'name': 'Eve' }).length, 0);
  });

  it('parse() / safeParse() / is() auto-register without prior register() call', () => {
    const registry = new SchemaRegistry({ logger: ConsoleLogger });
    assert.strictEqual(registry.is(ParseTestSchema, { 'name': 'Frank' }), true);
    assert.ok(registry.get(ParseTestSchema.$id) !== undefined);
  });
});
