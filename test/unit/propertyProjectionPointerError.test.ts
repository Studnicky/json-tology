/**
 * Regression test for PropertyProjection.ts — PropertyProjection.resolveSchema must:
 *   - Return {} for POINTER_NOT_FOUND (tolerated miss; the pointer path does not
 *     exist in the graph, which is a normal caller-recovery situation).
 *   - Re-throw any other GraphError, including POINTER_INVALID (a pointer that
 *     is syntactically invalid indicates a real bug and must not be swallowed).
 *
 * Before the fix, the catch block was a bare `catch { return {}; }` which
 * silently swallowed POINTER_INVALID errors, masking bugs in callers.
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { PropertyProjection } from '../../src/modules/rdf/PropertyProjection.js';
import { GraphError } from '../../src/errors/GraphError.js';

// ---------------------------------------------------------------------------
// Minimal schema for testing
// ---------------------------------------------------------------------------

const BookSchema = {
  '$id': 'https://example.com/Book',
  'properties': { 'title': { 'type': 'string' } },
  'type': 'object'
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

void describe('PropertyProjection.resolveSchema — pointer error handling', () => {
  const graph = new SchemaGraph(BookSchema);

  void it('returns the property schema when the pointer resolves normally', () => {
    // subject with a valid pointer path that exists in the graph
    const subject = 'https://example.com/Book#/properties/title';
    const schema = PropertyProjection.resolveSchema(graph, subject);

    assert.deepEqual(schema, { 'type': 'string' });
  });

  void it('returns {} (tolerated miss) when pointer is valid but node does not exist (POINTER_NOT_FOUND)', () => {
    // /properties/nonexistent is a valid JSON Pointer (starts with /) but
    // there is no such property in this graph — SchemaGraph throws POINTER_NOT_FOUND.
    const subject = 'https://example.com/Book#/properties/nonexistent';
    const schema = PropertyProjection.resolveSchema(graph, subject);

    assert.deepEqual(schema, {}, 'POINTER_NOT_FOUND should be swallowed and return {}');
  });

  void it('re-throws GraphError with code POINTER_INVALID when the pointer is syntactically invalid', () => {
    // A fragment that does not start with "/" is POINTER_INVALID.
    // Subject: https://example.com/Book#badpointer  → fragment = "badpointer"
    const subject = 'https://example.com/Book#badpointer';

    assert.throws(
      () => {
        PropertyProjection.resolveSchema(graph, subject);
      },
      (err: unknown) => {
        assert.ok(err instanceof GraphError, `expected GraphError, got ${String(err)}`);
        assert.equal(
          err.code,
          'POINTER_INVALID',
          `expected POINTER_INVALID, got ${err.code}`
        );

        return true;
      }
    );
  });
});
