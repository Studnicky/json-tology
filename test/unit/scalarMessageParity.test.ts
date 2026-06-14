/**
 * Regression tests: scalar constraint error message parity between the
 * compiled (SchemaCompiler / exec/Scalars.ts) and interpreted (GraphEngine /
 * GraphEngineScalars.ts) paths.
 *
 * Problem: both paths emitted different wording for the same violation:
 *   minLength: "must be at least N characters" vs "must NOT have fewer than N characters"
 *   maxLength: "must be at most N characters"  vs "must NOT have more than N characters"
 *   multipleOf: "must be multiple of N"         vs "must be a multiple of N"
 *
 * Canonical wording (chosen as JSON-Schema-idiomatic):
 *   minLength  → "must NOT have fewer than N characters"
 *   maxLength  → "must NOT have more than N characters"
 *   multipleOf → "must be a multiple of N"
 *
 * These tests assert that both paths emit exactly the same canonical message.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { JsonTology } from '../../src/index.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface PathErrors {
  'compiled': string[];
  'interpreted': string[];
}

/**
 * Collect error messages for a given keyword from both paths.
 */
function collectErrors(
  schema: Record<string, unknown> & { '$id': string },
  data: unknown,
  keyword: string
): PathErrors {
  const jt = JsonTology.create({
    'baseIRI': 'urn:test:scalar-parity:',
    'enableStrictGraph': false
  });

  jt.set(schema);

  // Compiled path
  const compiled = jt.registry.validator(schema.$id);
  const compiledResult = compiled.validate(data, { 'collectErrors': true });
  const compiledMsgs = compiledResult.errors
    .filter((err) => {
      return err.keyword === keyword;
    })
    .map((err) => {
      return err.message;
    });

  // Interpreted path
  const engine = jt.registry.engine(schema);
  const engineResult = engine.execute(data, { 'overrides': { 'collectErrors': true } });
  const interpretedMsgs = engineResult.errors
    .filter((err) => {
      return err.keyword === keyword;
    })
    .map((err) => {
      return err.message;
    });

  return {
    'compiled': compiledMsgs,
    'interpreted': interpretedMsgs
  };
}

// ---------------------------------------------------------------------------
// minLength parity
// ---------------------------------------------------------------------------

void describe('minLength error message parity', () => {
  void it('both paths emit the same minLength error message', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MinLength',
      'minLength': 5,
      'type': 'string'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 'hi', 'minLength');

    assert.ok(errors.compiled.length > 0, 'compiled should report a minLength error');
    assert.ok(errors.interpreted.length > 0, 'interpreted should report a minLength error');
    assert.strictEqual(
      errors.compiled[0],
      errors.interpreted[0],
      `message mismatch: compiled="${errors.compiled[0]}" interpreted="${errors.interpreted[0]}"`
    );
    assert.strictEqual(
      errors.compiled[0],
      'must NOT have fewer than 5 characters',
      `expected canonical wording, got: ${errors.compiled[0]}`
    );
  });

  void it('minLength canonical wording: "must NOT have fewer than N characters"', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MinLength2',
      'minLength': 10,
      'type': 'string'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 'short', 'minLength');

    assert.strictEqual(errors.compiled[0], 'must NOT have fewer than 10 characters');
    assert.strictEqual(errors.interpreted[0], 'must NOT have fewer than 10 characters');
  });
});

// ---------------------------------------------------------------------------
// maxLength parity
// ---------------------------------------------------------------------------

void describe('maxLength error message parity', () => {
  void it('both paths emit the same maxLength error message', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MaxLength',
      'maxLength': 3,
      'type': 'string'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 'toolong', 'maxLength');

    assert.ok(errors.compiled.length > 0, 'compiled should report a maxLength error');
    assert.ok(errors.interpreted.length > 0, 'interpreted should report a maxLength error');
    assert.strictEqual(
      errors.compiled[0],
      errors.interpreted[0],
      `message mismatch: compiled="${errors.compiled[0]}" interpreted="${errors.interpreted[0]}"`
    );
    assert.strictEqual(
      errors.compiled[0],
      'must NOT have more than 3 characters',
      `expected canonical wording, got: ${errors.compiled[0]}`
    );
  });
});

// ---------------------------------------------------------------------------
// multipleOf parity
// ---------------------------------------------------------------------------

void describe('multipleOf error message parity', () => {
  void it('both paths emit the same multipleOf error message', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MultipleOf',
      'multipleOf': 3,
      'type': 'number'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 7, 'multipleOf');

    assert.ok(errors.compiled.length > 0, 'compiled should report a multipleOf error');
    assert.ok(errors.interpreted.length > 0, 'interpreted should report a multipleOf error');
    assert.strictEqual(
      errors.compiled[0],
      errors.interpreted[0],
      `message mismatch: compiled="${errors.compiled[0]}" interpreted="${errors.interpreted[0]}"`
    );
    assert.strictEqual(
      errors.compiled[0],
      'must be a multiple of 3',
      `expected canonical wording, got: ${errors.compiled[0]}`
    );
  });
});
