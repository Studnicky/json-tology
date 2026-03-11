/**
 * Entity Builder Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';
import { EntityBuilder } from '../../src/schema/EntityBuilder.js';

const ConfigSchema = {
  '$id': 'https://example.io/config',
  '$schema': 'http://json-schema.org/draft-07/schema#',
  'properties': {
    'debug': {
      'default': false,
      'type': 'boolean',
    },
    'timeout': {
      'default': 5000,
      'type': 'number',
    },
    'name': { 'type': 'string' },
  },
  'required': ['name'],
  'type': 'object',
} as const;

const NestedSchema = {
  '$id': 'https://example.io/nested',
  '$schema': 'http://json-schema.org/draft-07/schema#',
  '$defs': {
    'Inner': {
      'properties': {
        'value': {
          'default': 42,
          'type': 'number',
        },
      },
      'type': 'object',
    },
  },
  'properties': {
    'inner': { '$ref': '#/$defs/Inner' },
  },
  'type': 'object',
} as const;

const StrictSchema = {
  '$id': 'https://example.io/strict',
  '$schema': 'http://json-schema.org/draft-07/schema#',
  'properties': {
    'name': { 'type': 'string' },
    'value': { 'type': 'number' },
  },
  'required': ['name'],
  'additionalProperties': false,
  'type': 'object',
} as const;

describe('EntityBuilder', () => {
  it('should build an entity with schema defaults', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    const config = builder.build(ConfigSchema, { 'name': 'test' });

    assert.strictEqual(config.name, 'test');
    assert.strictEqual(config.debug, false);
    assert.strictEqual(config.timeout, 5000);
  });

  it('should merge partial values with defaults', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    const config = builder.build(ConfigSchema, { 'name': 'custom', 'timeout': 10000 });

    assert.strictEqual(config.name, 'custom');
    assert.strictEqual(config.timeout, 10000);
    assert.strictEqual(config.debug, false);
  });

  it('should handle nested defaults via $ref', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    const nested = builder.build(NestedSchema, {});

    assert.strictEqual(nested['inner']['value'], 42);
  });

  it('should validate and throw on invalid data', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    assert.throws(
      () => builder.build(ConfigSchema, { 'name': 123 as unknown as string }),
      (err: Error) => err.message.includes('Invalid'),
    );
  });

  it('should throw if required property is missing', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    assert.throws(
      () => builder.build(ConfigSchema, {}),
      (err: Error) => err.message.includes('Invalid'),
    );
  });

  it('should build from partial without all required properties if they have defaults', () => {
    const SchemaWithDefaults = {
      '$id': 'https://example.io/all-defaults',
      '$schema': 'http://json-schema.org/draft-07/schema#',
      'properties': {
        'field': { 'default': 'default-value', 'type': 'string' },
      },
      'required': ['field'],
      'type': 'object',
    } as const;

    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    const result = builder.build(SchemaWithDefaults, {});
    assert.strictEqual(result.field, 'default-value');
  });

  it('should set non-required properties without defaults to undefined (never omit keys)', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    const config = builder.build(ConfigSchema, { 'name': 'test' });

    assert.ok('name' in config, 'name must be present');
    assert.ok('debug' in config, 'debug must be present');
    assert.ok('timeout' in config, 'timeout must be present');
  });

  it('should set non-required property with no default to undefined', () => {
    const SchemaWithOptional = {
      '$id': 'https://example.io/optional',
      '$schema': 'http://json-schema.org/draft-07/schema#',
      'properties': {
        'required': { 'type': 'string' },
        'optional': { 'type': 'string' },
      },
      'required': ['required'],
      'type': 'object',
    } as const;

    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    const result = builder.build(SchemaWithOptional, { 'required': 'yes' });

    assert.ok('optional' in result, 'optional key must be present on output');
    assert.strictEqual(result['optional'], undefined);
  });

  it('should auto-register the schema — no prior registry.register() needed', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    // No registry.register() call — build() handles it
    const config = builder.build(ConfigSchema, { 'name': 'auto' });
    assert.strictEqual(config.name, 'auto');

    // Schema should now be accessible from the registry
    assert.ok(registry.get(ConfigSchema.$id) !== undefined);
  });

  it('should coerce types when registry coerce: true', () => {
    const registry = new SchemaRegistry({ coerce: true });
    const builder = new EntityBuilder(registry);

    const config = builder.build(ConfigSchema, {
      'name': 'test',
      'timeout': '10000' as unknown as number,
    });

    assert.strictEqual(config.timeout, 10000);
    assert.strictEqual(typeof config.timeout, 'number');
  });

  it('should reject type mismatch without coerce option', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    assert.throws(
      () => builder.build(ConfigSchema, { 'name': 'test', 'timeout': '10000' as unknown as number }),
      (err: Error) => err.message.includes('Invalid'),
    );
  });

  it('should allow extra keys when passAdditionalProperties: true', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry, { passAdditionalProperties: true });

    const result = builder.build(StrictSchema, {
      'name': 'test',
      'extra': 'allowed' as unknown as never,
    });

    assert.strictEqual(result.name, 'test');
    assert.strictEqual((result as Record<string, unknown>)['extra'], 'allowed');
  });

  it('should throw on extra keys when passAdditionalProperties is not set', () => {
    const registry = new SchemaRegistry();
    const builder = new EntityBuilder(registry);

    assert.throws(
      () => builder.build(StrictSchema, { 'name': 'test', 'extra': 'not allowed' as unknown as never }),
      (err: Error) => err.message.includes('Invalid'),
    );
  });
});
