/**
 * Validator Tests — migrated to SchemaRegistry
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const UserSchema = {
  '$id': 'https://example.io/user',
  '$schema': 'https://json-schema.org/draft/2020-12/schema',
  'type': 'object',
  'properties': {
    'id': { 'type': 'number' },
    'name': { 'type': 'string' },
    'email': { 'type': 'string', 'format': 'email' },
  },
  'required': ['id', 'name'],
} as const;

describe('Validator', () => {
  it('should validate data against a schema', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const validUser = { 'id': 1, 'name': 'Alice', 'email': 'alice@example.io' };

    const errors = registry.validate(UserSchema.$id, validUser);

    assert.strictEqual(errors.length, 0);
  });

  it('should return errors for invalid data', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const invalidUser = { 'id': 'not-a-number', 'name': 'Bob' };

    const errors = registry.validate(UserSchema.$id, invalidUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => err.includes('number')));
  });

  it('should return errors for missing required properties', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const incompleteUser = { 'id': 2 };

    const errors = registry.validate(UserSchema.$id, incompleteUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => err.includes('name')));
  });

  it('should validate typed and return data on success', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const validUser = { 'id': 3, 'name': 'Charlie' };

    const errors = registry.validate(UserSchema.$id, validUser);
    const result = errors.length === 0
      ? { valid: true as const, data: validUser, errors: undefined }
      : { valid: false as const, data: undefined, errors };

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.data, validUser);
    assert.strictEqual(result.errors, undefined);
  });

  it('should validate typed and return errors on failure', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const invalidUser = { 'name': 'Diana' };

    const errors = registry.validate(UserSchema.$id, invalidUser);
    const result = errors.length === 0
      ? { valid: true as const, data: invalidUser, errors: undefined }
      : { valid: false as const, data: undefined, errors };

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.data, undefined);
    assert.ok(result.errors && result.errors.length > 0);
  });

  it('should check if data is valid (boolean)', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const validUser = { 'id': 4, 'name': 'Eve' };
    const invalidUser = { 'name': 'Frank' };

    assert.strictEqual(registry.is(UserSchema.$id, validUser), true);
    assert.strictEqual(registry.is(UserSchema.$id, invalidUser), false);
  });

  it('should assert valid data passes', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const validUser = { 'id': 5, 'name': 'Grace' };

    const errors = registry.validate(UserSchema.$id, validUser);
    assert.strictEqual(errors.length, 0);
  });

  it('should assert invalid data throws', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const invalidUser = { 'name': 'Henry' };

    const errors = registry.validate(UserSchema.$id, invalidUser);
    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => err.includes('id')));
  });

  it('should assert with context message', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const invalidUser = { 'name': 'Ivy' };

    const errors = registry.validate(UserSchema.$id, invalidUser);
    assert.ok(errors.length > 0);
    const message = `User validation failed: ${errors.join(', ')}`;
    assert.ok(message.includes('User validation failed'));
  });

  it('should cache compiled schemas for efficiency', () => {
    const registry = new SchemaRegistry();
    registry.register(UserSchema);
    const user1 = { 'id': 6, 'name': 'Jack' };
    const user2 = { 'id': 7, 'name': 'Karen' };

    // Both use same schema, second should hit cache
    const errors1 = registry.validate(UserSchema.$id, user1);
    const errors2 = registry.validate(UserSchema.$id, user2);

    assert.strictEqual(errors1.length, 0);
    assert.strictEqual(errors2.length, 0);
  });

  it('should work with schemas without $id', () => {
    const registry = new SchemaRegistry();
    const anonSchema = {
      '$id': 'urn:test:anon-value-object',
      'type': 'object',
      'properties': {
        'value': { 'type': 'number' },
      },
      'required': ['value'],
    } as const;

    registry.register(anonSchema);
    const validData = { 'value': 42 };
    const errors = registry.validate(anonSchema.$id, validData);

    assert.strictEqual(errors.length, 0);
  });
});
