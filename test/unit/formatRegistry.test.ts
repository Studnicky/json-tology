/**
 * FormatRegistry Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';

void describe('FormatRegistry', () => {
  void describe('FormatRegistry.builtin', () => {
    void it('has built-in string formats', () => {
      const registry = FormatRegistry.builtin();

      assert.ok(registry.has('email'));
      assert.ok(registry.has('uri'));
      assert.ok(registry.has('date'));
      assert.ok(registry.has('date-time'));
      assert.ok(registry.has('uuid'));
      assert.ok(registry.has('ipv4'));
      assert.ok(registry.has('ipv6'));
      assert.ok(registry.has('hostname'));
    });

    void it('has built-in number formats', () => {
      const registry = FormatRegistry.builtin();

      assert.ok(registry.has('int32'));
      assert.ok(registry.has('int64'));
      assert.ok(registry.has('float'));
      assert.ok(registry.has('double'));
    });

    void it('validates email format correctly', () => {
      const registry = FormatRegistry.builtin();
      const validator = registry.get('email');

      assert.ok(validator !== undefined);
      assert.ok(validator('user@example.com'));
      assert.ok(!validator('not-an-email'));
      assert.ok(!validator(42));
    });

    void it('validates int32 format correctly', () => {
      const registry = FormatRegistry.builtin();
      const validator = registry.get('int32');

      assert.ok(validator !== undefined);
      assert.ok(validator(42));
      assert.ok(!validator(2_147_483_648));
      assert.ok(!validator('42'));
    });
  });

  void describe('custom format registration', () => {
    void it('registers and retrieves a custom format', () => {
      const registry = new FormatRegistry();

      registry.register('phone', (value) => {
        return typeof value === 'string' && /^\+\d{10,15}$/u.test(value);
      });

      assert.ok(registry.has('phone'));

      const validator = registry.get('phone');

      assert.ok(validator !== undefined);
      assert.ok(validator('+1234567890'));
      assert.ok(!validator('not-a-phone'));
    });

    void it('returns undefined for unknown format', () => {
      const registry = new FormatRegistry();

      assert.strictEqual(registry.get('nonexistent'), undefined);
      assert.ok(!registry.has('nonexistent'));
    });
  });

  void describe('custom format used during validation', () => {
    void it('validates with a custom format via GraphEngine', () => {
      const registry = FormatRegistry.builtin();

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
    });
  });

  void describe('override built-in format', () => {
    void it('overrides the email format validator', () => {
      const registry = FormatRegistry.builtin();

      // Override email to reject everything
      registry.register('email', () => {
        return false;
      });

      const schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
          'https://json-schema.org/draft/2020-12/vocab/validation': true
        },
        'format': 'email',
        'type': 'string'
      };

      const engine = new GraphEngine(schema, { 'formatRegistry': registry });

      // Even valid emails should fail with overridden validator
      assert.ok(!engine.check('user@example.com'));
    });
  });
});
