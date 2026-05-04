/**
 * Per-field strict mode via jt:strict keyword
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const StrictFieldSchema = {
  '$id': 'https://ex.io/StrictField',
  'properties': {
    'age': {
      'jt:strict': true,
      'type': 'integer'
    },
    'name': { 'type': 'string' }
  },
  'required': [
    'age',
    'name'
  ],
  'type': 'object'
} as const;

const GlobalStrictConfigSchema = {
  '$id': 'https://ex.io/GlobalStrictConfig',
  'jt:config': { 'strict': true },
  'properties': {
    'count': { 'type': 'integer' },
    'label': {
      'jt:strict': false,
      'type': 'string'
    }
  },
  'required': [
    'count',
    'label'
  ],
  'type': 'object'
} as const;

void describe('jt:strict per-field', () => {
  void it('accepts correct JS type for strict field', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);
    const result = registry.instantiate(StrictFieldSchema.$id, {
      'age': 30,
      'name': 'Alice'
    });

    assert.deepEqual(result, {
      'age': 30,
      'name': 'Alice'
    });
  });

  void it('rejects string-as-integer for strict field even when global castTypes is on', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);

    assert.throws(() => {
      registry.instantiate(StrictFieldSchema.$id, {
        'age': '30',
        'name': 'Alice'
      });
    });
  });

  void it('coerces non-strict field normally when global castTypes is on', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);
    const result = registry.instantiate(StrictFieldSchema.$id, {
      'age': 30,
      'name': 42
    }) as Record<string, unknown>;

    assert.equal(result.name, '42');
  });

  void it('rejects boolean-as-integer for strict field', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);

    assert.throws(() => {
      registry.instantiate(StrictFieldSchema.$id, {
        'age': true,
        'name': 'Alice'
      });
    });
  });

  void it('accepts valid integer for strict field without castTypes', () => {
    const registry = new SchemaRegistry();

    registry.register(StrictFieldSchema);
    const result = registry.instantiate(StrictFieldSchema.$id, {
      'age': 5,
      'name': 'Bob'
    });

    assert.deepEqual(result, {
      'age': 5,
      'name': 'Bob'
    });
  });

  void it('jt:config.strict applies to all fields when set', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(GlobalStrictConfigSchema);

    assert.throws(() => {
      registry.instantiate(GlobalStrictConfigSchema.$id, {
        'count': '5',
        'label': 'hello'
      });
    });
  });

  void it('jt:strict: false opts out field when jt:config.strict is true', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(GlobalStrictConfigSchema);
    const result = registry.instantiate(GlobalStrictConfigSchema.$id, {
      'count': 5,
      'label': 99
    }) as Record<string, unknown>;

    assert.equal(result.label, '99');
  });

  void it('validate() reflects strict type failures', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);
    const errors = registry.validate(StrictFieldSchema.$id, {
      'age': '30',
      'name': 'Alice'
    });

    assert.ok(errors.length > 0);
  });

  void it('is() returns false for strict field type mismatch', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);

    assert.equal(registry.is(StrictFieldSchema.$id, {
      'age': '30',
      'name': 'Alice'
    }), false);
  });

  void it('is() returns true for correct types even with jt:strict', () => {
    const registry = new SchemaRegistry({ 'enableTypeCast': true });

    registry.register(StrictFieldSchema);

    assert.equal(registry.is(StrictFieldSchema.$id, {
      'age': 30,
      'name': 'Alice'
    }), true);
  });
});
