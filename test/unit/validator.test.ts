/**
 * Validator Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { Validator } from '../../src/schema/Validator.js';

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
    const validator = new Validator();
    const validUser = { 'id': 1, 'name': 'Alice', 'email': 'alice@example.io' };

    const errors = validator.validate(UserSchema, validUser);

    assert.strictEqual(errors.length, 0);
  });

  it('should return errors for invalid data', () => {
    const validator = new Validator();
    const invalidUser = { 'id': 'not-a-number', 'name': 'Bob' };

    const errors = validator.validate(UserSchema, invalidUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => err.includes('number')));
  });

  it('should return errors for missing required properties', () => {
    const validator = new Validator();
    const incompleteUser = { 'id': 2 };

    const errors = validator.validate(UserSchema, incompleteUser);

    assert.ok(errors.length > 0);
    assert.ok(errors.some((err) => err.includes('name')));
  });

  it('should validate typed and return data on success', () => {
    const validator = new Validator();
    const validUser = { 'id': 3, 'name': 'Charlie' };

    const result = validator.validateTyped(UserSchema, validUser);

    assert.strictEqual(result.valid, true);
    assert.deepStrictEqual(result.data, validUser);
    assert.strictEqual(result.errors, undefined);
  });

  it('should validate typed and return errors on failure', () => {
    const validator = new Validator();
    const invalidUser = { 'name': 'Diana' };

    const result = validator.validateTyped(UserSchema, invalidUser);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.data, undefined);
    assert.ok(result.errors && result.errors.length > 0);
  });

  it('should check if data is valid (boolean)', () => {
    const validator = new Validator();
    const validUser = { 'id': 4, 'name': 'Eve' };
    const invalidUser = { 'name': 'Frank' };

    assert.strictEqual(validator.isValid(UserSchema, validUser), true);
    assert.strictEqual(validator.isValid(UserSchema, invalidUser), false);
  });

  it('should assert valid data passes', () => {
    const validator = new Validator();
    const validUser = { 'id': 5, 'name': 'Grace' };

    assert.doesNotThrow(() => {
      validator.assert(UserSchema, validUser);
    });
  });

  it('should assert invalid data throws', () => {
    const validator = new Validator();
    const invalidUser = { 'name': 'Henry' };

    assert.throws(
      () => {
        validator.assert(UserSchema, invalidUser);
      },
      (err: Error) => err.message.includes('id')
    );
  });

  it('should assert with context message', () => {
    const validator = new Validator();
    const invalidUser = { 'name': 'Ivy' };

    assert.throws(
      () => {
        validator.assert(UserSchema, invalidUser, 'User validation failed');
      },
      (err: Error) => err.message.includes('User validation failed')
    );
  });

  it('should cache compiled schemas for efficiency', () => {
    const validator = new Validator();
    const user1 = { 'id': 6, 'name': 'Jack' };
    const user2 = { 'id': 7, 'name': 'Karen' };

    // Both use same schema, second should hit cache
    const errors1 = validator.validate(UserSchema, user1);
    const errors2 = validator.validate(UserSchema, user2);

    assert.strictEqual(errors1.length, 0);
    assert.strictEqual(errors2.length, 0);
  });

  it('should work with schemas without $id', () => {
    const validator = new Validator();
    const anonSchema = {
      'type': 'object',
      'properties': {
        'value': { 'type': 'number' },
      },
      'required': ['value'],
    } as const;

    const validData = { 'value': 42 };
    const errors = validator.validate(anonSchema, validData);

    assert.strictEqual(errors.length, 0);
  });
});
