/**
 * patternProperties Validation
 *
 * Tests patternProperties keyword, its interactions with properties and
 * additionalProperties, overlapping patterns, nested schemas, and edge cases.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

// ---------------------------------------------------------------------------
// Basic patternProperties
// ---------------------------------------------------------------------------

void describe('patternProperties basic matching', () => {
  void it('validates single pattern against declared schema', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/BasicString',
      'patternProperties': { '^S_': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'S_name': 'Alice' },
        'name': 'single matching key with valid type',
        'valid': true
      },
      {
        'data': {
          'S_a': 'x',
          'S_b': 'y'
        },
        'name': 'multiple matching keys with valid type',
        'valid': true
      },
      {
        'data': { 'S_count': 42 },
        'name': 'matching key with wrong type',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/BasicString', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates multiple distinct patterns independently', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/MultiPattern',
      'patternProperties': {
        '^I_': { 'type': 'integer' },
        '^S_': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'I_count': 5,
          'S_name': 'Alice'
        },
        'name': 'both patterns satisfied',
        'valid': true
      },
      {
        'data': { 'S_name': 42 },
        'name': 'S_ key with wrong type (number instead of string)',
        'valid': false
      },
      {
        'data': { 'I_count': 'five' },
        'name': 'I_ key with wrong type (string instead of integer)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/MultiPattern', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('allows keys that match no pattern when additionalProperties is not restricted', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/Unrestricted',
      'patternProperties': { '^S_': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [{
      'data': { 'other': 123 },
      'name': 'non-matching key passes when additionalProperties unrestricted',
      'valid': true
    }];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/Unrestricted', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// Overlapping patterns
// ---------------------------------------------------------------------------

void describe('patternProperties with overlapping patterns', () => {
  void it('applies all matching pattern schemas to a single property', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/Overlap',
      'patternProperties': {
        '^S_': { 'type': 'string' },
        '_name$': { 'minLength': 3 }
      },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'S_name': 'Alice' },
        'name': 'S_name matches both patterns, satisfies both',
        'valid': true
      },
      {
        'data': { 'S_name': 'Al' },
        'name': 'S_name matches both patterns, too short for _name$',
        'valid': false
      },
      {
        'data': { 'X_name': 'Bob' },
        'name': 'X_name matches only _name$, satisfies minLength',
        'valid': true
      },
      {
        'data': { 'X_name': 'Bo' },
        'name': 'X_name matches only _name$, too short',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/Overlap', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// patternProperties + properties on same key
// ---------------------------------------------------------------------------

void describe('patternProperties combined with properties on the same key', () => {
  void it('enforces both explicit property and pattern type constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/PropAndPattern',
      'patternProperties': { '^S_': { 'type': 'string' } },
      'properties': { 'S_name': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'S_name': 'Alice' },
        'name': 'S_name is string, satisfies both properties and pattern',
        'valid': true
      },
      {
        'data': { 'S_name': 99 },
        'name': 'S_name is not string, fails both properties and pattern',
        'valid': false
      },
      {
        'data': { 'S_other': 42 },
        'name': 'S_other matches pattern but wrong type',
        'valid': false
      },
      {
        'data': { 'S_other': 'ok' },
        'name': 'S_other matches pattern with correct type',
        'valid': true
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/PropAndPattern', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// patternProperties + additionalProperties schema
// ---------------------------------------------------------------------------

void describe('patternProperties with additionalProperties schema', () => {
  void it('applies additionalProperties schema to keys not matching any pattern', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/AdditionalSchema',
      'additionalProperties': { 'type': 'boolean' },
      'patternProperties': { '^S_': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'S_val': 'ok' },
        'name': 'pattern-matched key with valid type',
        'valid': true
      },
      {
        'data': { 'flag': true },
        'name': 'unmatched key satisfies additionalProperties boolean',
        'valid': true
      },
      {
        'data': { 'flag': 'not-a-boolean' },
        'name': 'unmatched key violates additionalProperties boolean',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/AdditionalSchema', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('allows explicit properties alongside pattern-matched properties', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/ExplicitAndPattern',
      'additionalProperties': { 'type': 'boolean' },
      'patternProperties': { '^x_': { 'type': 'number' } },
      'properties': { 'name': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'name': 'Alice',
          'x_score': 10
        },
        'name': 'explicit property + pattern-matched key both valid',
        'valid': true
      },
      {
        'data': {
          'name': 'Alice',
          'unknown': 'not-bool'
        },
        'name': 'unknown key fails additionalProperties boolean',
        'valid': false
      },
      {
        'data': {
          'extra': true,
          'name': 'Alice'
        },
        'name': 'unknown key satisfies additionalProperties boolean',
        'valid': true
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/ExplicitAndPattern', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// patternProperties + additionalProperties=false
// ---------------------------------------------------------------------------

void describe('patternProperties with additionalProperties false', () => {
  void it('allows only keys matching patterns when additionalProperties is false', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/PatternFalse',
      'additionalProperties': false,
      'patternProperties': {
        '^I_': { 'type': 'integer' },
        '^S_': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'I_count': 1,
          'S_name': 'ok'
        },
        'name': 'keys matching patterns are allowed',
        'valid': true
      },
      {
        'data': {},
        'name': 'empty object is valid',
        'valid': true
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/PatternFalse', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// Complex regex patterns
// ---------------------------------------------------------------------------

void describe('patternProperties with complex regex patterns', () => {
  void it('validates type constraints with anchored digit-only pattern', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/DigitKeys',
      'patternProperties': { '^\\d+$': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          '0': 'zero',
          '123': 'value'
        },
        'name': 'digit keys with valid string values',
        'valid': true
      },
      {
        'data': { '123': 42 },
        'name': 'digit key with wrong type (number instead of string)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/DigitKeys', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('validates type constraints with dot-separated key pattern', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/DotSep',
      'patternProperties': { '^[a-z]+(\\.[a-z]+)*$': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'app': 'v1',
          'app.server.host': 'localhost'
        },
        'name': 'dot-separated keys with valid string values',
        'valid': true
      },
      {
        'data': { 'app': 123 },
        'name': 'matching key with wrong type (number instead of string)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/DotSep', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// All items matching pattern
// ---------------------------------------------------------------------------

void describe('patternProperties where every key matches the pattern', () => {
  void it('validates when all keys conform to the single pattern schema', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/AllMatch',
      'patternProperties': { '^field_': { 'type': 'number' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'field_a': 1,
          'field_b': 2,
          'field_c': 3
        },
        'name': 'all keys match pattern with valid types',
        'valid': true
      },
      {
        'data': {
          'field_a': 1,
          'field_b': 'two'
        },
        'name': 'one key has wrong type',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/AllMatch', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// No matches — falls through to additionalProperties
// ---------------------------------------------------------------------------

void describe('patternProperties with no matching keys', () => {
  void it('treats unmatched keys per additionalProperties schema constraint', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/NoMatch',
      'additionalProperties': { 'type': 'boolean' },
      'patternProperties': { '^x_': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'flag': true,
          'other': false
        },
        'name': 'all unmatched keys satisfy additionalProperties boolean',
        'valid': true
      },
      {
        'data': { 'flag': 'not-a-boolean' },
        'name': 'unmatched key violates additionalProperties boolean',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/NoMatch', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('accepts empty objects regardless of pattern configuration', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/NoMatchEmpty',
      'additionalProperties': false,
      'patternProperties': { '^zzz_': { 'type': 'string' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [{
      'data': {},
      'name': 'empty object with additionalProperties false',
      'valid': true
    }];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/NoMatchEmpty', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// Nested schemas in patternProperties (via $defs + $ref)
// ---------------------------------------------------------------------------

void describe('patternProperties with nested object schemas', () => {
  void it('validates pattern property values against referenced nested object constraints', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$defs': {
        'Addr': {
          'properties': {
            'city': { 'type': 'string' },
            'zip': {
              'pattern': '^\\d{5}$',
              'type': 'string'
            }
          },
          'required': [
            'city',
            'zip'
          ],
          'type': 'object'
        }
      },
      '$id': 'https://pattern.test/Nested',
      'patternProperties': { '^addr_': { '$ref': '#/$defs/Addr' } },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'addr_home': {
            'city': 'Springfield',
            'zip': '62704'
          },
          'addr_work': {
            'city': 'Shelbyville',
            'zip': '62565'
          }
        },
        'name': 'multiple valid nested address objects',
        'valid': true
      },
      {
        'data': { 'addr_home': { 'city': 'Springfield' } },
        'name': 'missing required zip in nested object',
        'valid': false
      },
      {
        'data': {
          'addr_home': {
            'city': 'Springfield',
            'zip': 'bad'
          }
        },
        'name': 'invalid zip pattern in nested object',
        'valid': false
      },
      {
        'data': { 'addr_home': 'not an object' },
        'name': 'non-object value for pattern-matched key expecting object',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/Nested', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// patternProperties + required
// ---------------------------------------------------------------------------

void describe('patternProperties interaction with required', () => {
  void it('required applies to named keys only, not to patterns', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/WithRequired',
      'patternProperties': { '^opt_': { 'type': 'string' } },
      'properties': { 'id': { 'type': 'string' } },
      'required': ['id'],
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': { 'id': 'abc' },
        'name': 'required id present, no pattern-matched keys needed',
        'valid': true
      },
      {
        'data': {
          'id': 'abc',
          'opt_label': 'hello'
        },
        'name': 'required id present plus valid pattern-matched key',
        'valid': true
      },
      {
        'data': { 'opt_label': 'hello' },
        'name': 'missing required id',
        'valid': false
      },
      {
        'data': {
          'id': 'abc',
          'opt_count': 99
        },
        'name': 'required id present but pattern-matched key has wrong type',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/WithRequired', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});

// ---------------------------------------------------------------------------
// Multiple exclusive (non-overlapping) patterns
// ---------------------------------------------------------------------------

void describe('patternProperties with exclusive non-overlapping patterns', () => {
  void it('applies each pattern schema only to its own matching keys', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/Exclusive',
      'patternProperties': {
        '^bool_': { 'type': 'boolean' },
        '^num_': { 'type': 'number' },
        '^str_': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'bool_active': true,
          'num_score': 95,
          'str_name': 'Alice'
        },
        'name': 'all three patterns satisfied with correct types',
        'valid': true
      },
      {
        'data': { 'str_name': 123 },
        'name': 'str_ key with wrong type (number)',
        'valid': false
      },
      {
        'data': { 'num_score': 'high' },
        'name': 'num_ key with wrong type (string)',
        'valid': false
      },
      {
        'data': { 'bool_active': 'yes' },
        'name': 'bool_ key with wrong type (string)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/Exclusive', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });

  void it('handles mixed valid and invalid keys across exclusive patterns', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://pattern.test/ExclusiveMixed',
      'patternProperties': {
        '^ct_': { 'type': 'integer' },
        '^nm_': { 'type': 'string' }
      },
      'type': 'object'
    });

    const scenarios: Array<{ 'data': unknown;
      'name': string;
      'valid': boolean }> = [
      {
        'data': {
          'ct_items': 10,
          'nm_first': 'Ada'
        },
        'name': 'both patterns satisfied',
        'valid': true
      },
      {
        'data': {
          'ct_items': 'ten',
          'nm_first': 'Ada'
        },
        'name': 'ct_ key has wrong type (string instead of integer)',
        'valid': false
      }
    ];

    for (const {
      data, name, valid
    } of scenarios) {
      const errors = registry.validate('https://pattern.test/ExclusiveMixed', data);

      assert.equal(errors.length === 0, valid, name);
    }
  });
});
