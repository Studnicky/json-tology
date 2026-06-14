/**
 * Regression tests: anyOf/oneOf defaults + coercion parity between the
 * compiled (SchemaCompiler) and interpreted (GraphEngine) paths.
 *
 * Problem: anyOf/oneOf members in the compiled path used boolean-only checks
 * (compileNodeOrBooleanCheck), so defaults and coercion applied inside a branch
 * were discarded. The interpreted path (VisitComposition.anyOf/oneOf) runs the
 * full visitNode with applyDefaults+coercion and propagates the winning branch's
 * mutated value. These tests prove the two paths now produce identical output.
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
 * Run data through both the compiled validator and the interpreted GraphEngine
 * with applyDefaults=true, returning both output values.
 */
function runBothPaths(
  schema: Record<string, unknown> & { '$id': string },
  data: unknown,
  deps?: Array<Record<string, unknown> & { '$id': string }>
): { 'compiled': unknown;
  'interpreted': unknown } {
  const jt = JsonTology.create({
    'baseIRI': 'urn:test:anyof-defaults:',
    'enableStrictGraph': false
  });

  if (deps) {
    for (const dep of deps) {
      jt.set(dep);
    }
  }
  jt.set(schema);

  // Compiled path: validate with applyDefaults + collectErrors
  const compiledValidator = jt.registry.validator(schema.$id);
  const compiledResult = compiledValidator.validate(structuredClone(data), {
    'applyDefaults': true,
    'castTypes': false,
    'collectErrors': true
  });

  // Interpreted path: GraphEngine.execute with applyDefaults
  const engine = jt.registry.engine(schema);
  const engineResult = engine.execute(structuredClone(data), {
    'overrides': {
      'applyDefaults': true,
      'collectErrors': true
    }
  });

  return {
    'compiled': compiledResult.value,
    'interpreted': engineResult.value
  };
}

// ---------------------------------------------------------------------------
// anyOf: default inside a branch member
// ---------------------------------------------------------------------------

void describe('anyOf defaults parity — compiled vs interpreted', () => {
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

    const result = runBothPaths(schema, {});

    // Both paths should produce { name: 'Alice' }
    assert.deepStrictEqual(
      result.compiled,
      result.interpreted,
      `compiled=${JSON.stringify(result.compiled)}, interpreted=${JSON.stringify(result.interpreted)}`
    );
    assert.deepStrictEqual((result.compiled as Record<string, unknown>).name, 'Alice');
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

    const result = runBothPaths(schema, {});

    // Both paths pick the FIRST winning branch's value
    assert.deepStrictEqual(
      result.compiled,
      result.interpreted,
      `compiled=${JSON.stringify(result.compiled)}, interpreted=${JSON.stringify(result.interpreted)}`
    );
    assert.deepStrictEqual((result.compiled as Record<string, unknown>).kind, 'first');
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
    const result = runBothPaths(schema, {});

    assert.deepStrictEqual(
      result.compiled,
      result.interpreted,
      `compiled=${JSON.stringify(result.compiled)}, interpreted=${JSON.stringify(result.interpreted)}`
    );
    assert.deepStrictEqual((result.compiled as Record<string, unknown>).value, 42);
  });
});

// ---------------------------------------------------------------------------
// oneOf: default inside a branch member
// ---------------------------------------------------------------------------

void describe('oneOf defaults parity — compiled vs interpreted', () => {
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

    const result = runBothPaths(schema, {});

    assert.deepStrictEqual(
      result.compiled,
      result.interpreted,
      `compiled=${JSON.stringify(result.compiled)}, interpreted=${JSON.stringify(result.interpreted)}`
    );
    assert.deepStrictEqual((result.compiled as Record<string, unknown>).mode, 'auto');
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
    const result = runBothPaths(schema, { 'type': 'b' });

    assert.deepStrictEqual(
      result.compiled,
      result.interpreted,
      `compiled=${JSON.stringify(result.compiled)}, interpreted=${JSON.stringify(result.interpreted)}`
    );
    assert.deepStrictEqual((result.compiled as Record<string, unknown>).version, 1);
  });
});
