/**
 * Frozen output via jt:frozen keyword
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';

const MetaSchema = {
  '$id': 'https://ex.io/Meta',
  'properties': { 'tag': { 'type': 'string' } },
  'type': 'object'
} as const;

const FrozenSchema = {
  '$id': 'https://ex.io/Frozen',
  'jt:frozen': true,
  'properties': {
    'meta': { '$ref': 'https://ex.io/Meta' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

const FrozenViaConfigSchema = {
  '$id': 'https://ex.io/FrozenViaConfig',
  'jt:config': { 'frozen': true },
  'properties': { 'value': { 'type': 'number' } },
  'required': ['value'],
  'type': 'object'
} as const;

const MutableSchema = {
  '$id': 'https://ex.io/Mutable',
  'properties': { 'value': { 'type': 'string' } },
  'required': ['value'],
  'type': 'object'
} as const;

const FrozenArraySchema = {
  '$id': 'https://ex.io/FrozenArray',
  'jt:frozen': true,
  'properties': {
    'items': {
      'items': { 'type': 'string' },
      'type': 'array'
    }
  },
  'required': ['items'],
  'type': 'object'
} as const;

void describe('jt:frozen output', () => {
  void it('coerce() returns frozen object when jt:frozen is set', () => {
    const registry = new SchemaRegistry();

    registry.register(FrozenSchema);
    registry.register(MetaSchema);
    const result = registry.instantiate(FrozenSchema.$id, { 'name': 'Alice' });

    assert.ok(Object.isFrozen(result));
  });

  void it('coerce() returns mutable object when jt:frozen is not set', () => {
    const registry = new SchemaRegistry();

    registry.register(MutableSchema);
    const result = registry.instantiate(MutableSchema.$id, { 'value': 'hello' }) as Record<string, unknown>;

    assert.ok(!Object.isFrozen(result));
    result.value = 'mutated';
    assert.equal(result.value, 'mutated');
  });

  void it('mutation on frozen result throws in strict ESM mode', () => {
    const registry = new SchemaRegistry();

    registry.register(FrozenSchema);
    registry.register(MetaSchema);
    const result = registry.instantiate(FrozenSchema.$id, { 'name': 'Bob' }) as Record<string, unknown>;

    assert.throws(() => {
      result.name = 'Charlie';
    }, TypeError);
  });

  void it('nested objects are also frozen (deep freeze)', () => {
    const registry = new SchemaRegistry();

    registry.register(MetaSchema);
    registry.register(FrozenSchema);
    const result = registry.instantiate(FrozenSchema.$id, {
      'meta': { 'tag': 'test' },
      'name': 'Alice'
    }) as Record<string, unknown>;

    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.meta));
  });

  void it('arrays are frozen when parent has jt:frozen', () => {
    const registry = new SchemaRegistry();

    registry.register(FrozenArraySchema);
    const result = registry.instantiate(FrozenArraySchema.$id, {
      'items': [
        'a',
        'b'
      ]
    }) as Record<string, unknown>;

    assert.ok(Object.isFrozen(result));
    assert.ok(Object.isFrozen(result.items));
  });

  void it('jt:config.frozen works as shorthand for jt:frozen', () => {
    const registry = new SchemaRegistry();

    registry.register(FrozenViaConfigSchema);
    const result = registry.instantiate(FrozenViaConfigSchema.$id, { 'value': 42 });

    assert.ok(Object.isFrozen(result));
  });

  void it('materialize() returns frozen object when jt:frozen is set', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://ex.io',
      'schemas': [
        MetaSchema,
        FrozenSchema
      ] as const
    });
    const result = jt.materialize(FrozenSchema, { 'name': 'Alice' });

    assert.ok(Object.isFrozen(result));
  });

  void it('materialize() returns mutable object when jt:frozen is not set', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://ex.io',
      'schemas': [MutableSchema] as const
    });
    const result = jt.materialize(MutableSchema, { 'value': 'hello' }) as Record<string, unknown>;

    assert.ok(!Object.isFrozen(result));
  });

  void it('frozen output is cycle-safe (no infinite recursion)', () => {
    const registry = new SchemaRegistry();

    registry.register(FrozenSchema);
    registry.register(MetaSchema);

    assert.doesNotThrow(() => {
      registry.instantiate(FrozenSchema.$id, { 'name': 'safe' });
    });
  });
});
