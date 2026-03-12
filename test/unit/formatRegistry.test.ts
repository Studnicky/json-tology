/**
 * FormatRegistry Tests
 */

import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';

describe('FormatRegistry', () => {
  describe('FormatRegistry.builtin', () => {
    it('has built-in string formats', () => {
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

    it('has built-in number formats', () => {
      const registry = FormatRegistry.builtin();

      assert.ok(registry.has('int32'));
      assert.ok(registry.has('int64'));
      assert.ok(registry.has('float'));
      assert.ok(registry.has('double'));
    });

    it('validates email format correctly', () => {
      const registry = FormatRegistry.builtin();
      const validator = registry.get('email')!;

      assert.ok(validator('user@example.com'));
      assert.ok(!validator('not-an-email'));
      assert.ok(!validator(42));
    });

    it('validates int32 format correctly', () => {
      const registry = FormatRegistry.builtin();
      const validator = registry.get('int32')!;

      assert.ok(validator(42));
      assert.ok(!validator(2147483648));
      assert.ok(!validator('42'));
    });
  });

  describe('custom format registration', () => {
    it('registers and retrieves a custom format', () => {
      const registry = new FormatRegistry();

      registry.register('phone', (v) => typeof v === 'string' && /^\+\d{10,15}$/.test(v));

      assert.ok(registry.has('phone'));

      const validator = registry.get('phone')!;

      assert.ok(validator('+1234567890'));
      assert.ok(!validator('not-a-phone'));
    });

    it('returns undefined for unknown format', () => {
      const registry = new FormatRegistry();

      assert.strictEqual(registry.get('nonexistent'), undefined);
      assert.ok(!registry.has('nonexistent'));
    });
  });

  describe('custom format used during validation', () => {
    it('validates with a custom format via GraphEngine', () => {
      const registry = FormatRegistry.builtin();

      registry.register('hex-color', (v) => typeof v === 'string' && /^#[\da-f]{6}$/i.test(v));

      const schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/validation': true,
          'https://json-schema.org/draft/2020-12/vocab/format-assertion': true
        },
        'format': 'hex-color',
        'type': 'string'
      };

      const engine = new GraphEngine(schema, { 'formatRegistry': registry });

      assert.ok(engine.check('#ff00aa'));
      assert.ok(!engine.check('not-a-color'));
    });
  });

  describe('override built-in format', () => {
    it('overrides the email format validator', () => {
      const registry = FormatRegistry.builtin();

      // Override email to reject everything
      registry.register('email', () => false);

      const schema = {
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/validation': true,
          'https://json-schema.org/draft/2020-12/vocab/format-assertion': true
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
