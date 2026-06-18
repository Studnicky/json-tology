/**
 * Regression tests: anyOf/oneOf defaults propagation through the compiled
 * (SchemaCompiler) path.
 *
 * Problem: anyOf/oneOf members in the compiled path used boolean-only checks
 * (compileNodeOrBooleanCheck), so defaults and coercion applied inside a branch
 * were discarded. The fix propagates the winning branch's mutated value.
 * These tests verify the compiled path handles defaults correctly.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Run data through the compiled validator with applyDefaults=true, returning the output value.
 */
function runCompiled(
  schema: Record<string, unknown> & { '$id': string },
  data: unknown,
  deps?: Array<Record<string, unknown> & { '$id': string }>
): unknown {
  const jt = JsonTology.create({
    'baseIri': 'urn:test:anyof-defaults:',
    'enableStrictGraph': false
  });

  if (deps) {
    for (const dep of deps) {
      jt.set(dep);
    }
  }
  jt.set(schema);

  const compiledValidator = jt.registry.validator(schema.$id);
  const compiledResult = compiledValidator.validate(structuredClone(data), {
    'applyDefaults': true,
    'castTypes': false,
    'collectErrors': true
  });

  return compiledResult.value;
}

// ---------------------------------------------------------------------------
// anyOf: default inside a branch member
// ---------------------------------------------------------------------------

void describe('anyOf defaults — compiled path', () => {
  void it('anyOf member with default: compiled path propagates the default', () => {
    // Schema: anyOf with two branches; one branch has a property with a default.
    // Input: {} — the winning branch should fill in the default.
    const schema = {
      '$id': 'urn:test:anyof-defaults:WithDefault',
      'anyOf': [
        {
          'properties': {
            'name': {
              'default': 'Alice',
              'type': 'string'
            }
          },
          'type': 'object'
        },
        { 'type': 'null' }
      ]
    } as const as Record<string, unknown> & { '$id': string };

    const result = runCompiled(schema, {});

    assert.deepStrictEqual((result as Record<string, unknown>).name, 'Alice');
  });

  void it('anyOf first winning branch default is used over later branches', () => {
    const schema = {
      '$id': 'urn:test:anyof-defaults:FirstWins',
      'anyOf': [
        {
          'properties': {
            'kind': {
              'default': 'first',
              'type': 'string'
            }
          },
          'type': 'object'
        },
        {
          'properties': {
            'kind': {
              'default': 'second',
              'type': 'string'
            }
          },
          'type': 'object'
        }
      ]
    } as const as Record<string, unknown> & { '$id': string };

    const result = runCompiled(schema, {});

    assert.deepStrictEqual((result as Record<string, unknown>).kind, 'first');
  });

  void it('anyOf with required property: non-matching branch ignored, winning branch default applied', () => {
    const schema = {
      '$id': 'urn:test:anyof-defaults:RequiredBranch',
      'anyOf': [
        {
          'properties': {
            'tag': {
              'const': 'a',
              'type': 'string'
            }
          },
          'required': ['tag'],
          'type': 'object'
        },
        {
          'properties': {
            'value': {
              'default': 42,
              'type': 'number'
            }
          },
          'type': 'object'
        }
      ]
    } as const as Record<string, unknown> & { '$id': string };

    // {} does not satisfy first branch (missing required tag), but satisfies second
    const result = runCompiled(schema, {});

    assert.deepStrictEqual((result as Record<string, unknown>).value, 42);
  });
});

// ---------------------------------------------------------------------------
// oneOf: default inside a branch member
// ---------------------------------------------------------------------------

void describe('oneOf defaults — compiled path', () => {
  void it('oneOf member with default: compiled path propagates the winning branch default', () => {
    const schema = {
      '$id': 'urn:test:anyof-defaults:OneOfDefault',
      'oneOf': [
        {
          'properties': {
            'mode': {
              'default': 'auto',
              'type': 'string'
            }
          },
          'required': [] as string[],
          'type': 'object'
        },
        { 'type': 'null' }
      ]
    } as const as Record<string, unknown> & { '$id': string };

    const result = runCompiled(schema, {});

    assert.deepStrictEqual((result as Record<string, unknown>).mode, 'auto');
  });

  void it('oneOf exactly-one: winning branch default is propagated', () => {
    const schema = {
      '$id': 'urn:test:anyof-defaults:OneOfExact',
      'oneOf': [
        {
          'properties': {
            'type': {
              'const': 'a',
              'type': 'string'
            }
          },
          'required': ['type'],
          'type': 'object'
        },
        {
          'properties': {
            'type': {
              'const': 'b',
              'type': 'string'
            },
            'version': {
              'default': 1,
              'type': 'number'
            }
          },
          'required': ['type'],
          'type': 'object'
        }
      ]
    } as const as Record<string, unknown> & { '$id': string };

    // Only the second branch matches { type: 'b' }
    const result = runCompiled(schema, { 'type': 'b' });

    assert.deepStrictEqual((result as Record<string, unknown>).version, 1);
  });
});
