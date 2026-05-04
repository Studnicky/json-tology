/**
 * enableDefaults option — unit tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const WithDefaultSchema = {
  '$id': 'urn:test:WithDefault',
  'properties': {
    'name': { 'type': 'string' },
    'role': {
      'default': 'user',
      'type': 'string'
    }
  },
  'required': ['name'],
  'type': 'object'
} as const;

void describe('enableDefaults option', () => {
  void it('fills defaults by default (enableDefaults: true)', () => {
    const registry = new SchemaRegistry();

    registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

    const result = registry.instantiate(WithDefaultSchema.$id, { 'name': 'Alice' }) as Record<string, unknown>;

    assert.strictEqual(result.role, 'user', 'default should be filled');
  });

  void it('global opt-out: enableDefaults: false suppresses default-filling', () => {
    const registry = new SchemaRegistry({ 'enableDefaults': false });

    registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

    const result = registry.instantiate(WithDefaultSchema.$id, { 'name': 'Alice' }) as Record<string, unknown>;

    assert.strictEqual(result.role, undefined, 'default should NOT be filled');
  });

  void it('per-call opt-out overrides global true', () => {
    const registry = new SchemaRegistry();

    registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

    const result = registry.instantiate(
      WithDefaultSchema.$id,
      { 'name': 'Alice' },
      { 'enableDefaults': false }
    ) as Record<string, unknown>;

    assert.strictEqual(result.role, undefined, 'per-call false suppresses defaults');
  });

  void it('per-call opt-in overrides global false', () => {
    const registry = new SchemaRegistry({ 'enableDefaults': false });

    registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

    const result = registry.instantiate(
      WithDefaultSchema.$id,
      { 'name': 'Alice' },
      { 'enableDefaults': true }
    ) as Record<string, unknown>;

    assert.strictEqual(result.role, 'user', 'per-call true fills defaults');
  });

  void it('per-call options do not mutate registry stored default setting', () => {
    const registry = new SchemaRegistry();

    registry.register(WithDefaultSchema as unknown as Record<string, unknown>);

    registry.instantiate(WithDefaultSchema.$id, { 'name': 'Alice' }, { 'enableDefaults': false });

    const result2 = registry.instantiate(WithDefaultSchema.$id, { 'name': 'Bob' }) as Record<string, unknown>;

    assert.strictEqual(result2.role, 'user', 'subsequent call uses global default (true)');
  });
});
