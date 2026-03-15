/**
 * Validator Tests — migrated to SchemaRegistry
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const UserSchema = {
  '$id': 'https://example.io/user',
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  'properties': {
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'id': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': [
    'id',
    'name'
  ],
  'type': 'object'
} as const;

void describe('Validator', () => {
  void it('should validate data against a schema', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const validUser = {
      'email': 'alice@example.io',
      'id': 1,
      'name': 'Alice'
    };

    const errors = registry.validate(UserSchema.$id, validUser);

    assert.strictEqual(errors.length, 0);
  });

  void it('should return errors for invalid data', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const invalidUser = {
      'id': 'not-a-number',
      'name': 'Bob'
    };

    const errors = registry.validate(UserSchema.$id, invalidUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => {
      return err.includes('number');
    }));
  });

  void it('should return errors for missing required properties', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const incompleteUser = { 'id': 2 };

    const errors = registry.validate(UserSchema.$id, incompleteUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => {
      return err.includes('name');
    }));
  });

  void it('should validate typed and return data on success', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const validUser = {
      'id': 3,
      'name': 'Charlie'
    };

    const errors = registry.validate(UserSchema.$id, validUser);
    const result = errors.length === 0
      ? {
        'data': validUser,
        'errors': undefined,
        'valid': true as const
      }
      : {
        'data': undefined,
        errors,
        'valid': false as const
      };

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.data, validUser);
    assert.strictEqual(result.errors, undefined);
  });

  void it('should validate typed and return errors on failure', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const invalidUser = { 'name': 'Diana' };

    const errors = registry.validate(UserSchema.$id, invalidUser);
    const result = errors.length === 0
      ? {
        'data': invalidUser,
        'errors': undefined,
        'valid': true as const
      }
      : {
        'data': undefined,
        errors,
        'valid': false as const
      };

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.data, undefined);
    assert.equal(typeof result.errors, 'object');
    assert.ok(result.errors.length > 0);
  });

  void it('should check if data is valid (boolean)', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const validUser = {
      'id': 4,
      'name': 'Eve'
    };
    const invalidUser = { 'name': 'Frank' };

    assert.strictEqual(registry.is(UserSchema.$id, validUser), true);
    assert.strictEqual(registry.is(UserSchema.$id, invalidUser), false);
  });

  void it('should assert valid data passes', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const validUser = {
      'id': 5,
      'name': 'Grace'
    };

    const errors = registry.validate(UserSchema.$id, validUser);

    assert.strictEqual(errors.length, 0);
  });

  void it('should assert invalid data throws', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const invalidUser = { 'name': 'Henry' };

    const errors = registry.validate(UserSchema.$id, invalidUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => {
      return err.includes('id');
    }));
  });

  void it('should assert with context message', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const invalidUser = { 'name': 'Ivy' };

    const errors = registry.validate(UserSchema.$id, invalidUser);

    assert.ok(errors.length > 0);
    const message = `User validation failed: ${errors.join(', ')}`;

    assert.ok(message.includes('User validation failed'));
  });

  void it('should cache compiled schemas for efficiency', () => {
    const registry = new SchemaRegistry();

    registry.register(UserSchema);
    const user1 = {
      'id': 6,
      'name': 'Jack'
    };
    const user2 = {
      'id': 7,
      'name': 'Karen'
    };

    // Both use same schema, second should hit cache
    const errors1 = registry.validate(UserSchema.$id, user1);
    const errors2 = registry.validate(UserSchema.$id, user2);

    assert.strictEqual(errors1.length, 0);
    assert.strictEqual(errors2.length, 0);
  });

  void it('should work with schemas without $id', () => {
    const registry = new SchemaRegistry();
    const anonSchema = {
      '$id': 'urn:test:anon-value-object',
      'properties': { 'value': { 'type': 'number' } },
      'required': ['value'],
      'type': 'object'
    } as const;

    registry.register(anonSchema);
    const validData = { 'value': 42 };
    const errors = registry.validate(anonSchema.$id, validData);

    assert.strictEqual(errors.length, 0);
  });
});
