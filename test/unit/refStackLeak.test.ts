/**
 * Regression tests for compiled validator idempotence across multiple calls.
 *
 * The original test verified interpreter refStack cleanup via try/finally.
 * Now that the compiled path is the sole executor, these tests verify that
 * subsequent validator calls remain accurate regardless of prior call results.
 */

import assert from 'node:assert/strict';
import {
  describe, it
} from 'node:test';
import { JsonTology } from '../../src/index.js';

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

void describe('refStack leak — compiled validator idempotence', { 'concurrency': false }, () => {
  void it('after one validation call, a subsequent call with invalid $ref data returns valid:false', () => {
    const jt = JsonTology.create({
      'baseIRI': 'urn:refstack:',
      'enableStrictGraph': false,
      'schemas': [NodeSchema] as const
    });

    // First call: valid data (deep chain — compiled path has no depth limit)
    const v1 = jt.registry.validator(NodeSchema.$id).validate(chain(10), { 'collectErrors': true });

    assert.equal(v1.valid, true, 'valid chain passes');

    // Second call: invalid $ref target (number where object required)
    const v2 = jt.registry.validator(NodeSchema.$id).validate({
      'name': 'root',
      'next': 999
    }, { 'collectErrors': true });

    assert.equal(v2.valid, false, 'invalid $ref target (999) should fail on second call');
  });
});
