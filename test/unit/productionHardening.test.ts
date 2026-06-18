/**
 * Production hardening tests — validates defensive behavior at API boundaries,
 * correctness for edge-case numeric values, and error handling in the validation pipeline.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  JsonTology, SchemaError
} from '../../src/index.js';
// SchemaRegistry direct lifecycle assertions — production-hardening tests reach into the
// registration boundary that JsonTology composes; the registry exposes hardening-specific
// behaviour (duplicate $anchor, registration-time validation) not surfaced publicly.
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
// FormatRegistry tests its built-in / custom format registration mechanics directly; the
// public API exposes formats only as a config option, not as the registry instance.
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';

// ---------------------------------------------------------------------------
// Finding 1: Infinity bypass
// ---------------------------------------------------------------------------

void describe('Infinity rejection (type: number)', () => {
  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  registry.set({
    '$id': 'urn:hardening:number',
    'type': 'number'
  });
  registry.set({
    '$id': 'urn:hardening:integer',
    'type': 'integer'
  });
  registry.set({
    '$id': 'urn:hardening:bounded',
    'maximum': 100,
    'minimum': 0,
    'type': 'number'
  });

  const scenarios: Array<{ 'data': unknown;
    'name': string;
    'schema': string;
    'valid': boolean }> = [
    {
      'data': 42,
      'name': 'valid: normal number',
      'schema': 'urn:hardening:number',
      'valid': true
    },
    {
      'data': 0,
      'name': 'valid: zero',
      'schema': 'urn:hardening:number',
      'valid': true
    },
    {
      'data': -3.14,
      'name': 'valid: negative float',
      'schema': 'urn:hardening:number',
      'valid': true
    },
    {
      'data': Infinity,
      'name': 'unhappy: Infinity rejected as number',
      'schema': 'urn:hardening:number',
      'valid': false
    },
    {
      'data': -Infinity,
      'name': 'unhappy: -Infinity rejected as number',
      'schema': 'urn:hardening:number',
      'valid': false
    },
    {
      'data': Number.NaN,
      'name': 'unhappy: NaN rejected as number',
      'schema': 'urn:hardening:number',
      'valid': false
    },
    {
      'data': Infinity,
      'name': 'unhappy: Infinity rejected as integer',
      'schema': 'urn:hardening:integer',
      'valid': false
    },
    {
      'data': Infinity,
      'name': 'unhappy: Infinity rejected by bounded schema',
      'schema': 'urn:hardening:bounded',
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of scenarios) {
    void it(name, () => {
      const errors = registry.validate(schema, data);

      assert.equal(errors.length === 0, valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Finding 1b: Infinity in coercion path
// ---------------------------------------------------------------------------

void describe('Infinity coercion rejection', () => {
  const scenarios: Array<{ 'input': string;
    'name': string;
    'shouldCoerce': boolean }> = [
    {
      'input': '42',
      'name': 'valid: string "42" coerces to 42',
      'shouldCoerce': true
    },
    {
      'input': 'Infinity',
      'name': 'unhappy: string "Infinity" does not coerce to number',
      'shouldCoerce': false
    },
    {
      'input': '-Infinity',
      'name': 'unhappy: string "-Infinity" does not coerce to number',
      'shouldCoerce': false
    },
    {
      'input': 'NaN',
      'name': 'unhappy: string "NaN" does not coerce to number',
      'shouldCoerce': false
    }
  ];

  for (const {
    input, name, shouldCoerce
  } of scenarios) {
    void it(name, () => {
      const registry = new SchemaRegistry({
        'enableStrictGraph': false,
        'enableTypeCast': true
      });

      registry.set({
        '$id': 'urn:hardening:cast-number',
        'type': 'number'
      });
      if (shouldCoerce) {
        const result = registry.instantiate('urn:hardening:cast-number', input);

        assert.equal(typeof result, 'number', name);
        assert.ok(Number.isFinite(result), name);
      } else {
        assert.throws(() => {
          registry.instantiate('urn:hardening:cast-number', input);
        }, name);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Finding 2: multipleOf zero
// ---------------------------------------------------------------------------

void describe('multipleOf zero rejection', () => {
  const registry = new SchemaRegistry({ 'enableStrictGraph': false });

  registry.set({
    '$id': 'urn:hardening:multiple-zero',
    'multipleOf': 0,
    'type': 'number'
  });
  registry.set({
    '$id': 'urn:hardening:multiple-three',
    'multipleOf': 3,
    'type': 'number'
  });

  const scenarios: Array<{ 'data': unknown;
    'name': string;
    'schema': string;
    'valid': boolean }> = [
    {
      'data': 5,
      'name': 'unhappy: multipleOf 0 always fails',
      'schema': 'urn:hardening:multiple-zero',
      'valid': false
    },
    {
      'data': 0,
      'name': 'unhappy: multipleOf 0 fails even for zero',
      'schema': 'urn:hardening:multiple-zero',
      'valid': false
    },
    {
      'data': 9,
      'name': 'valid: 9 is multiple of 3',
      'schema': 'urn:hardening:multiple-three',
      'valid': true
    },
    {
      'data': 10,
      'name': 'unhappy: 10 is not multiple of 3',
      'schema': 'urn:hardening:multiple-three',
      'valid': false
    }
  ];

  for (const {
    data, name, schema, valid
  } of scenarios) {
    void it(name, () => {
      const errors = registry.validate(schema, data);

      assert.equal(errors.length === 0, valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Finding 3: Compilation fallback logging
// ---------------------------------------------------------------------------

void describe('compilation fallback produces working validator', () => {
  void it('validates correctly even when compiled path falls back', () => {
    const registry = new SchemaRegistry({ 'enableStrictGraph': false });

    registry.set({
      '$id': 'urn:hardening:fallback',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    });

    assert.ok(registry.validate('urn:hardening:fallback', { 'name': 'Alice' }).ok);
    assert.notEqual(registry.validate('urn:hardening:fallback', {}).length, 0);
  });
});

// ---------------------------------------------------------------------------
// Finding 6: Format validator error handling
// ---------------------------------------------------------------------------

void describe('format validator error handling', () => {
  const scenarios: Array<{ 'name': string;
    'valid': boolean
    'value': unknown; }> = [
    {
      'name': 'catches throwing format validator and reports format error',
      'valid': false,
      'value': 'test-value'
    },
    {
      'name': 'another string also fails when validator throws',
      'valid': false,
      'value': 'another-string'
    }
  ];

  for (const {
    name, valid, value
  } of scenarios) {
    void it(name, () => {
      const formatRegistry = FormatRegistry.builtin();

      formatRegistry.set('throwing', () => {
        throw new Error('validator exploded');
      });
      const registry = new SchemaRegistry({
        'enableStrictGraph': false,
        'formatRegistry': formatRegistry
      });

      registry.set({
        '$id': 'urn:hardening:throwing-format',
        '$schema': 'https://json-schema.org/draft/2020-12/schema',
        '$vocabulary': {
          'https://json-schema.org/draft/2020-12/vocab/core': true,
          'https://json-schema.org/draft/2020-12/vocab/format-assertion': true,
          'https://json-schema.org/draft/2020-12/vocab/validation': true
        },
        'format': 'throwing',
        'type': 'string'
      });
      const errors = registry.validate('urn:hardening:throwing-format', value);

      assert.equal(errors.length === 0, valid, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Finding 7: Null/undefined schemaId guard
// ---------------------------------------------------------------------------

void describe('null/undefined schema guard on public API', () => {
  const jt = JsonTology.create({
    'baseIri': 'urn:test',
    'enableStrictGraph': false,
    'schemas': [{
      '$id': 'urn:hardening:guard',
      'type': 'object'
    }] as const
  });

  const methods: Array<{ 'fn': () => void;
    'name': string }> = [
    {
      'fn': () => {
        jt.validate(null as unknown as 'urn:hardening:guard', {});
      },
      'name': 'validate() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.validate(undefined as unknown as 'urn:hardening:guard', {});
      },
      'name': 'validate() throws SchemaError for undefined'
    },
    {
      'fn': () => {
        jt.instantiate(null as unknown as 'urn:hardening:guard', {});
      },
      'name': 'coerce() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.validate(null as unknown as 'urn:hardening:guard', {});
      },
      'name': 'validate() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.is(null as unknown as 'urn:hardening:guard', {});
      },
      'name': 'is() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.subschemaAt(null as unknown as 'urn:hardening:guard', '/properties/x');
      },
      'name': 'subschemaAt() throws SchemaError for null'
    }
  ];

  for (const {
    fn, name
  } of methods) {
    void it(name, () => {
      assert.throws(fn, (error: unknown) => {
        return error instanceof SchemaError && error.code === 'SCHEMA_INVALID_INPUT';
      }, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Finding 8: register() input validation
// ---------------------------------------------------------------------------

void describe('register() input validation', () => {
  const scenarios: Array<{ 'input': unknown;
    'name': string }> = [
    {
      'input': null,
      'name': 'throws SchemaError for null'
    },
    {
      'input': undefined,
      'name': 'throws SchemaError for undefined'
    },
    {
      'input': 'a string',
      'name': 'throws SchemaError for string'
    },
    {
      'input': 42,
      'name': 'throws SchemaError for number'
    },
    {
      'input': [null],
      'name': 'throws SchemaError for array containing null'
    },
    {
      'input': [42],
      'name': 'throws SchemaError for array containing number'
    }
  ];

  for (const {
    input, name
  } of scenarios) {
    void it(name, () => {
      const registry = new SchemaRegistry({ 'enableStrictGraph': false });

      assert.throws(() => {
        registry.set(input as Record<string, unknown>);
      }, (error: unknown) => {
        return error instanceof SchemaError && error.code === 'SCHEMA_INVALID_INPUT';
      }, name);
    });
  }
});

// ---------------------------------------------------------------------------
// Schema freeze on registration
// ---------------------------------------------------------------------------

void describe('schema freeze on registration', () => {
  const scenarios: Array<{ 'check': (registry: SchemaRegistry) => void;
    'name': string }> = [
    {
      'check': (registry) => {
        const schema = {
          '$id': 'urn:freeze:basic',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        };

        registry.set(schema);
        assert.ok(Object.isFrozen(schema), 'schema is frozen after registration');
      },
      'name': 'freezes schema object on registration'
    },
    {
      'check': (registry) => {
        const schema = {
          '$id': 'urn:freeze:nested',
          'properties': {
            'age': { 'type': 'number' },
            'name': { 'type': 'string' }
          },
          'required': ['name'],
          'type': 'object'
        };

        registry.set(schema);
        assert.ok(Object.isFrozen(schema.properties), 'properties object is frozen');
        assert.ok(Object.isFrozen(schema.properties.name), 'nested property descriptor is frozen');
      },
      'name': 'deep-freezes nested schema properties'
    },
    {
      'check': (registry) => {
        const schema = {
          '$id': 'urn:freeze:mutate',
          'properties': { 'name': { 'type': 'string' } },
          'type': 'object'
        };

        registry.set(schema);
        assert.throws(() => {
          (schema as Record<string, unknown>).newProp = true;
        }, TypeError, 'mutation attempt throws TypeError');
      },
      'name': 'mutation after registration throws TypeError'
    },
    {
      'check': (registry) => {
        const schema = Object.freeze({
          '$id': 'urn:freeze:already',
          'type': 'object'
        });

        registry.set(schema);
        assert.ok(Object.isFrozen(schema), 'already-frozen schema stays frozen');
      },
      'name': 'accepts already-frozen schemas without error'
    }
  ];

  for (const {
    check, name
  } of scenarios) {
    void it(name, () => {
      const registry = new SchemaRegistry({ 'enableStrictGraph': false });

      check(registry);
    });
  }
});

