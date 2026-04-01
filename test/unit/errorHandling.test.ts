/**
 * Error Handling Edge Cases
 *
 * Verifies correct error types, messages, and recovery behavior
 * across the public API surface.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { JsonTology } from '../../src/JsonTology.js';
import { CoercionError } from '../../src/errors/CoercionError.js';
import { SchemaError } from '../../src/errors/SchemaError.js';

// ---------------------------------------------------------------------------
// SchemaError -- registration failures
// ---------------------------------------------------------------------------

void describe('SchemaError on registration', () => {
  void it('throws SchemaError for invalid registrations', () => {
    const scenarios: Array<{ 'messageContains': string;
      'name': string;
      'schema': Record<string, unknown> }> = [
      {
        'messageContains': '$id',
        'name': 'missing $id',
        'schema': { 'type': 'object' }
      },
      {
        'messageContains': 'Duplicate $anchor',
        'name': 'duplicate $anchor within same schema',
        'schema': {
          '$defs': {
            'A': {
              '$anchor': 'dup',
              'type': 'string'
            },
            'B': {
              '$anchor': 'dup',
              'type': 'number'
            }
          },
          '$id': 'https://err.test/DupAnchor',
          'type': 'object'
        }
      }
    ];

    for (const {
      messageContains, name, schema
    } of scenarios) {
      const registry = new SchemaRegistry();

      try {
        registry.register(schema);
        assert.fail(`${name}: should throw`);
      } catch (error) {
        assert.ok(error instanceof SchemaError, `${name}: instanceof SchemaError`);
        assert.ok((error).message.includes(messageContains), `${name}: message contains '${messageContains}'`);
      }
    }
  });

  void it('throws SchemaError for conflicting overwrite', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://err.test/Original',
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    });

    try {
      registry.register({
        '$id': 'https://err.test/Original',
        'properties': { 'y': { 'type': 'number' } },
        'type': 'object'
      });
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof SchemaError, 'conflicting overwrite: instanceof SchemaError');
      assert.ok((error).message.includes('already registered'), 'conflicting overwrite: message');
    }
  });

  void it('SchemaError has code and toJson()', () => {
    const registry = new SchemaRegistry();

    try {
      registry.register({ 'type': 'object' });
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof SchemaError, 'instanceof SchemaError');
      assert.ok(typeof error.code === 'string', 'code is string');
      const json = error.toJson();

      assert.ok(typeof json.code === 'string', 'toJson().code is string');
      assert.ok(typeof json.message === 'string', 'toJson().message is string');
    }
  });
});

// ---------------------------------------------------------------------------
// BaseError cause chain and flatten edge cases
// ---------------------------------------------------------------------------

void describe('BaseError cause chain edge cases', () => {
  void it('handles error edge cases for cause and flatten', () => {
    const scenarios: Array<{
      'assertions': () => void;
      'name': string;
    }> = [
      {
        'assertions': () => {
          const error = new SchemaError('TEST_CODE', 'no cause');

          assert.equal(error.cause, undefined, 'edge: undefined cause — cause is undefined');
          const json = error.toJson();

          assert.equal(json.cause, undefined, 'edge: undefined cause — toJson().cause is undefined');
        },
        'name': 'edge: error with undefined cause serializes without cause field'
      },
      {
        'assertions': () => {
          const root = new SchemaError('ROOT', 'root error');
          const mid = new SchemaError('MID', 'mid error', false, { 'cause': root });
          const top = new SchemaError('TOP', 'top error', false, { 'cause': mid });

          const chain = top.flatten();

          assert.equal(chain.length, 3, 'edge: nested cause chain — 3 deep');
          assert.equal(chain[0].code, 'TOP', 'edge: nested cause chain — first is top');
          assert.equal(chain[1].code, 'MID', 'edge: nested cause chain — second is mid');
          assert.equal(chain[2].code, 'ROOT', 'edge: nested cause chain — third is root');
        },
        'name': 'edge: error with nested cause chain (3 deep) flattens correctly'
      },
      {
        'assertions': () => {
          const single = new SchemaError('SINGLE', 'single error');
          const chain = single.flatten();

          assert.equal(chain.length, 1, 'edge: single error flatten — length 1');
          assert.equal(chain[0].code, 'SINGLE', 'edge: single error flatten — code matches');
          assert.equal(chain[0].message, 'single error', 'edge: single error flatten — message matches');
        },
        'name': 'edge: error flatten with single error returns one-element array'
      }
    ];

    for (const {
      assertions, name
    } of scenarios) {
      assertions();
      assert.ok(true, name);
    }
  });
});

// ---------------------------------------------------------------------------
// CoercionError -- validation failures during coerce
// ---------------------------------------------------------------------------

void describe('CoercionError structure', () => {
  void it('carries structured ValidationErrors with items', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://err.test/Person',
      'properties': {
        'age': {
          'minimum': 0,
          'type': 'integer'
        },
        'name': { 'type': 'string' }
      },
      'required': [
        'name',
        'age'
      ],
      'type': 'object'
    });

    try {
      registry.coerce('https://err.test/Person', { 'age': -5 });
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof CoercionError, 'instanceof CoercionError');
      assert.ok(error.errors.length > 0, 'has errors');

      const items = error.errors.items;

      assert.ok(items.length > 0, 'has error items');
      for (const item of items) {
        assert.ok(typeof item.path === 'string', 'item has path');
        assert.ok(typeof item.keyword === 'string', 'item has keyword');
        assert.ok(typeof item.message === 'string', 'item has message');
      }
    }
  });

  void it('reports multiple errors simultaneously', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://err.test/Multi',
      'properties': {
        'email': {
          'format': 'email',
          'type': 'string'
        },
        'name': {
          'minLength': 1,
          'type': 'string'
        }
      },
      'required': [
        'name',
        'email'
      ],
      'type': 'object'
    });

    try {
      registry.coerce('https://err.test/Multi', {});
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof CoercionError, 'instanceof CoercionError');
      assert.ok(error.errors.length >= 2, 'reports both missing required fields');
    }
  });

  void it('CoercionError.toJson() serializes cleanly', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://err.test/Serial',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    try {
      registry.coerce('https://err.test/Serial', {});
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof CoercionError, 'instanceof CoercionError');
      const json = error.toJson();

      assert.ok(typeof json.code === 'string', 'toJson().code is string');
      assert.ok(typeof json.message === 'string', 'toJson().message is string');
      const str = JSON.stringify(json);

      assert.ok(str.length > 0, 'serializes to non-empty JSON string');
    }
  });
});

// ---------------------------------------------------------------------------
// Registry recovery after errors
// ---------------------------------------------------------------------------

void describe('Registry recovery', () => {
  void it('remains usable after failed registration', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://err.test/Good',
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    });

    assert.throws(() => {
      registry.register({
        '$id': 'https://err.test/Bad',
        'properties': {
          'nested': {
            'properties': { 'y': { 'type': 'number' } },
            'type': 'object'
          }
        },
        'type': 'object'
      });
    });

    const recoveryChecks: Array<{ 'check': () => void;
      'name': string }> = [
      {
        'check': () => {
          assert.deepEqual(registry.validate('https://err.test/Good', { 'x': 'hello' }), []);
        },
        'name': 'original schema still validates'
      },
      {
        'check': () => {
          assert.ok(registry.get('https://err.test/Good') !== undefined);
        },
        'name': 'original schema still retrievable'
      },
      {
        'check': () => {
          assert.equal(registry.get('https://err.test/Bad'), undefined);
        },
        'name': 'failed schema not registered'
      }
    ];

    for (const {
      check, name
    } of recoveryChecks) {
      check();
      assert.ok(true, name);
    }
  });

  void it('remains usable after CoercionError', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://err.test/Recover',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    assert.throws(() => {
      registry.coerce('https://err.test/Recover', {});
    });

    const result = registry.coerce('https://err.test/Recover', { 'x': 42 }) as Record<string, unknown>;

    assert.equal(result.x, 42, 'registry works for valid data after CoercionError');
  });
});

// ---------------------------------------------------------------------------
// JsonTology facade error handling
// ---------------------------------------------------------------------------

void describe('JsonTology error handling', () => {
  void it('handles unregistered schema operations', () => {
    const jt = JsonTology.create({ 'baseIRI': 'https://err.test' });

    const scenarios: Array<{ 'check': () => void;
      'name': string }> = [
      {
        'check': () => {
          const errors = jt.validate('https://err.test/Missing' as never, {});

          assert.ok(errors.length > 0, 'validate returns errors');
          assert.ok(errors[0].includes('No validator'), 'validate mentions No validator');
        },
        'name': 'validate returns errors for unregistered schema ID'
      },
      {
        'check': () => {
          assert.throws(() => {
            jt.coerce('https://err.test/Missing' as never, {});
          });
        },
        'name': 'coerce throws for unregistered schema'
      },
      {
        'check': () => {
          assert.throws(() => {
            jt.is('https://err.test/Missing' as never, {});
          });
        },
        'name': 'is throws for unregistered schema'
      },
      {
        'check': () => {
          const errs = jt.errors('https://err.test/Missing' as never, {});

          assert.ok(errs.length > 0, 'errors returns non-empty');
        },
        'name': 'errors returns non-empty ValidationErrors for unregistered schema'
      }
    ];

    for (const {
      check, name
    } of scenarios) {
      check();
      assert.ok(true, name);
    }
  });
});
