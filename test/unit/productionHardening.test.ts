/**
 * Production hardening tests — validates defensive behavior at API boundaries,
 * correctness for edge-case numeric values, and error handling in the validation pipeline.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';
import { SchemaError } from '../../src/errors/SchemaError.js';
import { GraphError } from '../../src/errors/GraphError.js';
import { FormatRegistry } from '../../src/modules/format/FormatRegistry.js';
import { GraphEngine } from '../../src/modules/graph/GraphEngine.js';

// ---------------------------------------------------------------------------
// Finding 1: Infinity bypass
// ---------------------------------------------------------------------------

void describe('Infinity rejection (type: number)', () => {
  const registry = new SchemaRegistry();

  registry.register({
    '$id': 'urn:hardening:number',
    'type': 'number'
  });
  registry.register({
    '$id': 'urn:hardening:integer',
    'type': 'integer'
  });
  registry.register({
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
      const registry = new SchemaRegistry({ 'castTypes': true });

      registry.register({
        '$id': 'urn:hardening:cast-number',
        'type': 'number'
      });
      if (shouldCoerce) {
        const result = registry.coerce('urn:hardening:cast-number', input);

        assert.equal(typeof result, 'number', name);
        assert.ok(Number.isFinite(result as number), name);
      } else {
        assert.throws(() => {
          registry.coerce('urn:hardening:cast-number', input);
        }, name);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// Finding 2: multipleOf zero
// ---------------------------------------------------------------------------

void describe('multipleOf zero rejection', () => {
  const registry = new SchemaRegistry();

  registry.register({
    '$id': 'urn:hardening:multiple-zero',
    'multipleOf': 0,
    'type': 'number'
  });
  registry.register({
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
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:hardening:fallback',
      'properties': { 'name': { 'type': 'string' } },
      'required': ['name'],
      'type': 'object'
    });

    assert.deepEqual(registry.validate('urn:hardening:fallback', { 'name': 'Alice' }), []);
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

      formatRegistry.register('throwing', () => {
        throw new Error('validator exploded');
      });
      const registry = new SchemaRegistry({ 'formatRegistry': formatRegistry });

      registry.register({
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
    'baseIRI': 'urn:test',
    'schemas': [{
      '$id': 'urn:hardening:guard',
      'type': 'object'
    }] as const
  });

  const methods: Array<{ 'fn': () => void;
    'name': string }> = [
    {
      'fn': () => {
        jt.validate(null as unknown as string, {});
      },
      'name': 'validate() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.validate(undefined as unknown as string, {});
      },
      'name': 'validate() throws SchemaError for undefined'
    },
    {
      'fn': () => {
        jt.coerce(null as unknown as string, {});
      },
      'name': 'coerce() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.errors(null as unknown as string, {});
      },
      'name': 'errors() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.is(null as unknown as string, {});
      },
      'name': 'is() throws SchemaError for null'
    },
    {
      'fn': () => {
        jt.validateAt(null as unknown as string, '/properties/x', {});
      },
      'name': 'validateAt() throws SchemaError for null'
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
      const registry = new SchemaRegistry();

      assert.throws(() => {
        registry.register(input as Record<string, unknown>);
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

        registry.register(schema);
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

        registry.register(schema);
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

        registry.register(schema);
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

        registry.register(schema as Record<string, unknown>);
        assert.ok(Object.isFrozen(schema), 'already-frozen schema stays frozen');
      },
      'name': 'accepts already-frozen schemas without error'
    }
  ];

  for (const {
    check, name
  } of scenarios) {
    void it(name, () => {
      const registry = new SchemaRegistry();

      check(registry);
    });
  }
});

// ---------------------------------------------------------------------------
// maxDepth option
// ---------------------------------------------------------------------------

void describe('maxDepth option', () => {
  void it('engine.execute() respects maxDepth and throws RECURSION_LIMIT', () => {
    const schema: Record<string, unknown> = {
      '$id': 'urn:hardening:tree',
      'properties': {
        'child': {
          'anyOf': [
            { '$ref': 'urn:hardening:tree' },
            { 'type': 'null' }
          ]
        }
      },
      'type': 'object'
    };

    const engine = new GraphEngine(schema, {
      'lookupSchema': () => {
        return schema;
      },
      'maxDepth': 3
    });

    // Shallow data passes
    const shallow = engine.execute({ 'child': null });

    assert.ok(shallow.valid, 'shallow data within depth limit');

    // Deep data throws
    assert.throws(() => {
      engine.execute({ 'child': { 'child': { 'child': { 'child': { 'child': null } } } } });
    }, (error: unknown) => {
      return error instanceof GraphError && error.code === 'RECURSION_LIMIT';
    }, 'deep data exceeds maxDepth');
  });

  void it('defaults to no limit when maxDepth is not set', () => {
    const schema: Record<string, unknown> = {
      '$id': 'urn:hardening:deep',
      'properties': {
        'child': {
          'anyOf': [
            { '$ref': 'urn:hardening:deep' },
            { 'type': 'null' }
          ]
        }
      },
      'type': 'object'
    };

    const engine = new GraphEngine(schema, {
      'lookupSchema': () => {
        return schema;
      }
    });

    let nested: Record<string, unknown> = { 'child': null };

    for (let index = 0; index < 50; index++) {
      nested = { 'child': nested };
    }
    const result = engine.execute(nested);

    assert.ok(result.valid, 'deeply nested data validates without limit');
  });
});
