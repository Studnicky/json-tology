/**
 * FormatRegistry Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { FormatRegistry } from '../../src/modules/format/formatRegistry.js';
import { GraphEngine } from '../../src/modules/graph/graphEngine.js';

void describe('FormatRegistry', () => {
  void it('has built-in string and number formats with correct validation', () => {
    const registry = FormatRegistry.builtin();

    // String formats exist
    for (const fmt of [
      'email',
      'uri',
      'date',
      'date-time',
      'uuid',
      'ipv4',
      'ipv6',
      'hostname'
    ]) {
      assert.ok(registry.has(fmt));
    }

    // Number formats exist
    for (const fmt of [
      'int32',
      'int64',
      'float',
      'double'
    ]) {
      assert.ok(registry.has(fmt));
    }

    // Email validation
    const email = registry.get('email');

    assert.ok(email !== undefined);
    assert.ok(email('user@example.com'));
    assert.ok(!email('not-an-email'));
    assert.ok(!email(42));

    // int32 validation
    const int32 = registry.get('int32');

    assert.ok(int32 !== undefined);
    assert.ok(int32(42));
    assert.ok(!int32(2_147_483_648));
    assert.ok(!int32('42'));
  });

  void it('registers custom formats and returns undefined for unknown', () => {
    const registry = new FormatRegistry();

    registry.register('phone', (value) => {
      return typeof value === 'string' && /^\+\d{10,15}$/u.test(value);
    });
    assert.ok(registry.has('phone'));

    const validator = registry.get('phone');

    assert.ok(validator !== undefined);
    assert.ok(validator('+1234567890'));
    assert.ok(!validator('not-a-phone'));

    // Unknown format
    assert.strictEqual(registry.get('nonexistent'), undefined);
    assert.ok(!registry.has('nonexistent'));
  });

  void it('validates with custom format via GraphEngine and supports override', () => {
    const registry = FormatRegistry.builtin();

    // Custom format
    registry.register('hex-color', (value) => {
      return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value);
    });

    const schema = {
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'format': 'hex-color',
      'type': 'string'
    };

    const engine = new GraphEngine(schema, { 'formatRegistry': registry });

    assert.ok(engine.check('#ff00aa'));
    assert.ok(!engine.check('not-a-color'));

    // Override built-in
    registry.register('email', () => {
      return false;
    });

    const emailSchema = {
      '$schema': 'https://json-schema.org/draft/2020-12/schema',
      '$vocabulary': {
        'https://json-schema.org/draft/2020-12/vocab/core': true,
        'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
        'https://json-schema.org/draft/2020-12/vocab/validation': true
      },
      'format': 'email',
      'type': 'string'
    };

    const emailEngine = new GraphEngine(emailSchema, { 'formatRegistry': registry });

    assert.ok(!emailEngine.check('user@example.com'));
  });
});
