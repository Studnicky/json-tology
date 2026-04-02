/**
 * FormatRegistry Tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';
import { GraphEngine } from '../../src/modules/graph/graphEngine.js';

void describe('FormatRegistry', () => {
  void describe('built-in format validation', () => {
    const builtinScenarios: Array<{
      'format': string;
      'name': string;
      'valid': boolean;
      'value': unknown;
    }> = [
      // --- string formats: email ---
      {
        'format': 'email',
        'name': 'happy: valid email passes',
        'valid': true,
        'value': 'user@example.com'
      },
      {
        'format': 'email',
        'name': 'unhappy: non-email string fails',
        'valid': false,
        'value': 'not-an-email'
      },
      {
        'format': 'email',
        'name': 'unhappy: number fails email validation',
        'valid': false,
        'value': 42
      },
      {
        'format': 'email',
        'name': 'edge: empty string fails email validation',
        'valid': false,
        'value': ''
      },
      // --- number formats: int32 ---
      {
        'format': 'int32',
        'name': 'happy: valid int32 passes',
        'valid': true,
        'value': 42
      },
      {
        'format': 'int32',
        'name': 'unhappy: value exceeding int32 range fails',
        'valid': false,
        'value': 2_147_483_648
      },
      {
        'format': 'int32',
        'name': 'unhappy: string fails int32 validation',
        'valid': false,
        'value': '42'
      },
      // --- format existence ---
      {
        'format': 'uri',
        'name': 'happy: uri format exists and validates',
        'valid': true,
        'value': 'https://example.com'
      },
      {
        'format': 'date',
        'name': 'happy: date format exists and validates',
        'valid': true,
        'value': '2024-01-15'
      },
      {
        'format': 'uuid',
        'name': 'happy: uuid format exists and validates',
        'valid': true,
        'value': '550e8400-e29b-41d4-a716-446655440000'
      }
    ];

    const registry = FormatRegistry.builtin();

    for (const {
      'format': format, 'name': name, 'valid': valid, 'value': value
    } of builtinScenarios) {
      void it(name, () => {
        assert.ok(registry.has(format));
        const validator = registry.get(format);

        assert.ok(validator !== undefined);
        assert.equal(validator(value), valid);
      });
    }

    const formatExistenceScenarios: Array<{
      'format': string;
      'name': string;
    }> = [
      {
        'format': 'email',
        'name': 'happy: email format registered'
      },
      {
        'format': 'uri',
        'name': 'happy: uri format registered'
      },
      {
        'format': 'date',
        'name': 'happy: date format registered'
      },
      {
        'format': 'date-time',
        'name': 'happy: date-time format registered'
      },
      {
        'format': 'uuid',
        'name': 'happy: uuid format registered'
      },
      {
        'format': 'ipv4',
        'name': 'happy: ipv4 format registered'
      },
      {
        'format': 'ipv6',
        'name': 'happy: ipv6 format registered'
      },
      {
        'format': 'hostname',
        'name': 'happy: hostname format registered'
      },
      {
        'format': 'int32',
        'name': 'happy: int32 format registered'
      },
      {
        'format': 'int64',
        'name': 'happy: int64 format registered'
      },
      {
        'format': 'float',
        'name': 'happy: float format registered'
      },
      {
        'format': 'double',
        'name': 'happy: double format registered'
      }
    ];

    for (const {
      'format': format, 'name': name
    } of formatExistenceScenarios) {
      void it(name, () => {
        assert.ok(registry.has(format));
      });
    }
  });

  void describe('custom format registration', () => {
    const customScenarios: Array<{
      'name': string;
      'valid': boolean;
      'value': unknown;
    }> = [
      {
        'name': 'happy: valid phone number passes',
        'valid': true,
        'value': '+1234567890'
      },
      {
        'name': 'unhappy: non-phone string fails',
        'valid': false,
        'value': 'not-a-phone'
      },
      {
        'name': 'edge: empty string fails phone validation',
        'valid': false,
        'value': ''
      }
    ];

    const registry = new FormatRegistry();

    registry.register('phone', (value) => {
      return typeof value === 'string' && /^\+\d{10,15}$/u.test(value);
    });

    for (const {
      'name': name, 'valid': valid, 'value': value
    } of customScenarios) {
      void it(name, () => {
        assert.ok(registry.has('phone'));
        const validator = registry.get('phone');

        assert.ok(validator !== undefined);
        assert.equal(validator(value), valid);
      });
    }

    void it('edge: unknown format returns undefined', () => {
      assert.strictEqual(registry.get('nonexistent'), undefined);
      assert.ok(!registry.has('nonexistent'));
    });
  });

  void describe('GraphEngine integration and override', () => {
    void it('happy: validates with custom format via GraphEngine', () => {
      const registry = FormatRegistry.builtin();

      registry.register('hex-color', (value) => {
        return typeof value === 'string' && /^#[\da-f]{6}$/iu.test(value);
      });

      const schema: Record<string, unknown> = {
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

    void it('edge: registering over existing format overrides it', () => {
      const registry = FormatRegistry.builtin();

      registry.register('email', () => {
        return false;
      });

      const emailSchema: Record<string, unknown> = {
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
});
