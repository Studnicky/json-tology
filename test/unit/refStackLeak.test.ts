/**
 * Regression tests for refStack leak in Refs.resolveDynamicRef / Refs.resolveRef
 * and Unevaluated.rdfsRange.
 *
 * Before the fix, a throw inside visitNode (e.g. RECURSION_LIMIT) left the
 * refKey in the instance-level refStack permanently. Because GraphEngine reuses
 * an instance-level refStack across execute() calls, subsequent validations
 * treat those refs as cycles and return valid:true without checking them.
 *
 * Concretely: call A exceeds maxSchemaDepth and throws, leaving refKey in the
 * stack. Call B then has a $ref to the same target — the $ref check sees the
 * key already in the stack, assumes a cycle, and returns valid:true without
 * validating the $ref target. Call B's invalid $ref target is therefore
 * silently accepted as valid.
 *
 * After the fix, the refStack.delete always runs via try/finally, so the
 * stack is clean after any throw and subsequent calls behave correctly.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import {
  GraphError, JsonTology
} from '../../src/index.js';

// ---------------------------------------------------------------------------
// Schema: a self-referential linked-list node.
// ---------------------------------------------------------------------------
const NodeSchema = {
  '$id': 'urn:refstack:Node',
  'properties': {
    'name': { 'type': 'string' },
    'next': { '$ref': 'urn:refstack:Node' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

/** Build a chain of depth+1 nodes: root → n0 → … → n(depth-1). */
function chain(depth: number): Record<string, unknown> {
  const root: Record<string, unknown> = { 'name': 'root' };
  let cursor = root;

  for (let i = 0; i < depth; i++) {
    const child: Record<string, unknown> = { 'name': `n${i}` };

    cursor['next'] = child;
    cursor = child;
  }

  return root;
}

void describe('refStack leak — Refs.resolveRef try/finally fix', { 'concurrency': false }, () => {
  void it('after a RECURSION_LIMIT throw, a subsequent call with invalid $ref data returns valid:false', () => {
    // maxSchemaDepth: 2 → depth > 2 throws. A 4-level chain (root → n0 → n1 → n2)
    // reaches schema depth 3 when following $ref for n1.next → throws.
    const jt = JsonTology.create({
      'baseIRI': 'urn:refstack:',
      'enableStrictGraph': false,
      'maxSchemaDepth': 2,
      'schemas': [NodeSchema] as const
    });
    const engine = jt.registry.engine(NodeSchema);

    // === Step 1: poison the refStack (old code) or verify it stays clean (new code) ===
    assert.throws(
      () => {
        return engine.execute(chain(3));
      },
      (err: unknown) => {
        return err instanceof GraphError && err.code === 'RECURSION_LIMIT';
      },
      'expected RECURSION_LIMIT on 4-level chain with maxSchemaDepth:2'
    );

    // === Step 2: next is an invalid value (number, not an object) ===
    // The $ref 'urn:refstack:Node' resolves to the NodeSchema which requires
    // an object with a string 'name'. Passing 999 as next should fail.
    //
    // Bug (pre-fix): the stale refKey in the refStack causes the $ref resolution
    // in resolveRef to short-circuit (refStack.has(refKey) → true) and return
    // {valid:true} without validating 999 against NodeSchema.
    //
    // Fix: try/finally in resolveRef ensures the refKey is removed after any
    // throw, so the refStack is clean and 999 is properly validated.
    const result = engine.execute({
      'name': 'root',
      // invalid: not an object, and missing required 'name'
      'next': 999
    });

    // With the bug: result.valid is true (999 was never checked via $ref).
    // With the fix: result.valid is false (999 fails the object type check).
    assert.equal(result.valid, false, 'invalid $ref target (999) should fail after prior RECURSION_LIMIT throw');
  });
});
