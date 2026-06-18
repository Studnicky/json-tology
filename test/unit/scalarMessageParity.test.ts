/**
 * Regression tests: scalar constraint error messages from the compiled
 * (SchemaCompiler / exec/Scalars.ts) path.
 *
 * Canonical wording:
 *   minLength  → "must NOT have fewer than N characters"
 *   maxLength  → "must NOT have more than N characters"
 *   multipleOf → "must be a multiple of N"
 *
 * These tests assert that the compiled path emits exactly the canonical messages.
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
 * Collect error messages for a given keyword from the compiled path.
 */
function collectErrors(
  schema: Record<string, unknown> & { '$id': string },
  data: unknown,
  keyword: string
): string[] {
  const jt = JsonTology.create({
    'baseIri': 'urn:test:scalar-parity:',
    'enableStrictGraph': false
  });

  jt.set(schema);

  const compiled = jt.registry.validator(schema.$id);
  const compiledResult = compiled.validate(data, { 'collectErrors': true });

  return compiledResult.errors
    .filter((err) => {
      return err.keyword === keyword;
    })
    .map((err) => {
      return err.message;
    });
}

// ---------------------------------------------------------------------------
// minLength
// ---------------------------------------------------------------------------

void describe('minLength error messages', () => {
  void it('compiled path emits the canonical minLength error message', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MinLength',
      'minLength': 5,
      'type': 'string'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 'hi', 'minLength');

    assert.ok(errors.length > 0, 'compiled should report a minLength error');
    assert.strictEqual(
      errors[0],
      'must NOT have fewer than 5 characters',
      `expected canonical wording, got: ${errors[0]}`
    );
  });

  void it('minLength canonical wording: "must NOT have fewer than N characters"', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MinLength2',
      'minLength': 10,
      'type': 'string'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 'short', 'minLength');

    assert.strictEqual(errors[0], 'must NOT have fewer than 10 characters');
  });
});

// ---------------------------------------------------------------------------
// maxLength
// ---------------------------------------------------------------------------

void describe('maxLength error messages', () => {
  void it('compiled path emits the canonical maxLength error message', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MaxLength',
      'maxLength': 3,
      'type': 'string'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 'toolong', 'maxLength');

    assert.ok(errors.length > 0, 'compiled should report a maxLength error');
    assert.strictEqual(
      errors[0],
      'must NOT have more than 3 characters',
      `expected canonical wording, got: ${errors[0]}`
    );
  });
});

// ---------------------------------------------------------------------------
// multipleOf
// ---------------------------------------------------------------------------

void describe('multipleOf error messages', () => {
  void it('compiled path emits the canonical multipleOf error message', () => {
    const schema = {
      '$id': 'urn:test:scalar-parity:MultipleOf',
      'multipleOf': 3,
      'type': 'number'
    } as const as Record<string, unknown> & { '$id': string };

    const errors = collectErrors(schema, 7, 'multipleOf');

    assert.ok(errors.length > 0, 'compiled should report a multipleOf error');
    assert.strictEqual(
      errors[0],
      'must be a multiple of 3',
      `expected canonical wording, got: ${errors[0]}`
    );
  });
});
