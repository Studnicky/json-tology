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
import {
  InstantiationError, JsonTology, SchemaError
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// SchemaError -- registration failures
// ---------------------------------------------------------------------------

void describe('SchemaError on registration', { 'concurrency': true }, () => {
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
      const jt = JsonTology.create({
        'baseIRI': 'urn:test:',
        'enableStrictGraph': false
      });

      try {
        // Negative-test boundary: scenarios deliberately omit $id / carry
        // duplicate anchors to assert registration rejects malformed schemas.
        jt.set(schema as unknown as { readonly '$id': string });
        assert.fail(`${name}: should throw`);
      } catch (error) {
        assert.ok(error instanceof SchemaError, `${name}: instanceof SchemaError`);
        assert.ok((error).message.includes(messageContains), `${name}: message contains '${messageContains}'`);
      }
    }
  });

  void it('set() replaces an existing schema with new content (Map semantics)', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': false
    });

    jt.set({
      '$id': 'https://err.test/Original',
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    });

    jt.set({
      '$id': 'https://err.test/Original',
      'properties': { 'y': { 'type': 'number' } },
      'type': 'object'
    });

    const replaced = jt.registry.get('https://err.test/Original');

    assert.ok(replaced !== undefined, 'schema is registered after replace');
    assert.deepStrictEqual(
      (replaced).properties,
      { 'y': { 'type': 'number' } },
      'replaced schema has the new content'
    );
  });

  void it('SchemaError has code and toJson()', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': false
    });

    try {
      // Negative-test boundary: schema deliberately omits $id to assert throw.
      jt.set({ 'type': 'object' } as unknown as { readonly '$id': string });
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

void describe('BaseError cause chain edge cases', { 'concurrency': true }, () => {
  void it('handles error edge cases for cause and flatten', () => {
    const scenarios: Array<{
      'assertions': () => void;
      'name': string;
    }> = [
      {
        'assertions': () => {
          const error = new SchemaError('SCHEMA_INVALID_INPUT', 'no cause');

          assert.equal(error.cause, undefined, 'edge: undefined cause — cause is undefined');
          const json = error.toJson();

          assert.equal(json.cause, undefined, 'edge: undefined cause — toJson().cause is undefined');
        },
        'name': 'edge: error with undefined cause serializes without cause field'
      },
      {
        'assertions': () => {
          const root = new SchemaError('SCHEMA_MISSING_ID', 'root error');
          const mid = new SchemaError('SCHEMA_DUPLICATE_ID', 'mid error', { 'cause': root });
          const top = new SchemaError('SCHEMA_STRUCTURE_INVALID', 'top error', { 'cause': mid });

          const chain = top.flatten();

          assert.equal(chain.length, 3, 'edge: nested cause chain — 3 deep');
          assert.equal(chain[0].code, 'SCHEMA_STRUCTURE_INVALID', 'edge: nested cause chain — first is top');
          assert.equal(chain[1].code, 'SCHEMA_DUPLICATE_ID', 'edge: nested cause chain — second is mid');
          assert.equal(chain[2].code, 'SCHEMA_MISSING_ID', 'edge: nested cause chain — third is root');
        },
        'name': 'edge: error with nested cause chain (3 deep) flattens correctly'
      },
      {
        'assertions': () => {
          const single = new SchemaError('SCHEMA_NOT_REGISTERED', 'single error');
          const chain = single.flatten();

          assert.equal(chain.length, 1, 'edge: single error flatten — length 1');
          assert.equal(chain[0].code, 'SCHEMA_NOT_REGISTERED', 'edge: single error flatten — code matches');
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
// InstantiationError -- validation failures during coerce
// ---------------------------------------------------------------------------

void describe('InstantiationError structure', { 'concurrency': true }, () => {
  void it('carries structured ValidationErrors with items', () => {
    // enableStrictGraph: false — synthetic fixture schema with inline minimum
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': false
    });

    jt.set({
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
      jt.instantiate('https://err.test/Person', { 'age': -5 });
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof InstantiationError, 'instanceof InstantiationError');
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
    // enableStrictGraph: false — synthetic fixture schema with inline format/minLength
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': false
    });

    jt.set({
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
      jt.instantiate('https://err.test/Multi', {});
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof InstantiationError, 'instanceof InstantiationError');
      assert.ok(error.errors.length >= 2, 'reports both missing required fields');
    }
  });

  void it('InstantiationError.toJson() serializes cleanly', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': false
    });

    jt.set({
      '$id': 'https://err.test/Serial',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    try {
      jt.instantiate('https://err.test/Serial', {});
      assert.fail('should throw');
    } catch (error) {
      assert.ok(error instanceof InstantiationError, 'instanceof InstantiationError');
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

void describe('Registry recovery', { 'concurrency': true }, () => {
  void it('remains usable after failed registration', () => {
    // Use enableStrictGraph to trigger inline-object error (default mode is silent)
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': true
    });

    jt.set({
      '$id': 'https://err.test/Good',
      'properties': { 'x': { 'type': 'string' } },
      'type': 'object'
    });

    assert.throws(() => {
      jt.set({
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
          assert.ok(jt.validate('https://err.test/Good', { 'x': 'hello' }).ok);
        },
        'name': 'original schema still validates'
      },
      {
        'check': () => {
          assert.ok(jt.registry.get('https://err.test/Good') !== undefined);
        },
        'name': 'original schema still retrievable'
      },
      {
        'check': () => {
          assert.equal(jt.registry.get('https://err.test/Bad'), undefined);
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

  void it('remains usable after InstantiationError', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:test:',
      'enableStrictGraph': false
    });

    jt.set({
      '$id': 'https://err.test/Recover',
      'properties': { 'x': { 'type': 'number' } },
      'required': ['x'],
      'type': 'object'
    });

    assert.throws(() => {
      jt.instantiate('https://err.test/Recover', {});
    });

    const result = jt.instantiate('https://err.test/Recover', { 'x': 42 }) as Record<string, unknown>;

    assert.equal(result.x, 42, 'jt works for valid data after InstantiationError');
  });
});

// ---------------------------------------------------------------------------
// JsonTology facade error handling
// ---------------------------------------------------------------------------

void describe('JsonTology error handling', { 'concurrency': true }, () => {
  void it('handles unregistered schema operations', () => {
    const jt = JsonTology.create({
      'baseIRI': 'https://err.test',
      'enableStrictGraph': false
    });

    const scenarios: Array<{ 'check': () => void;
      'name': string }> = [
      {
        'check': () => {
          assert.throws(() => {
            jt.validate('https://err.test/Missing' as never, {});
          }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
        },
        'name': 'validate throws for unregistered schema ID'
      },
      {
        'check': () => {
          assert.throws(() => {
            jt.instantiate('https://err.test/Missing' as never, {});
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
          assert.throws(() => {
            jt.validate('https://err.test/Missing' as never, {});
          }, /No validator registered|SCHEMA_NOT_REGISTERED/u);
        },
        'name': 'validate throws for unregistered schema'
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
