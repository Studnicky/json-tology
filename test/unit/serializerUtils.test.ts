/**
 * serializerUtils tests — ensureArray and normalizeArrays
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  ensureArray, normalizeArrays
} from '../../src/modules/ontology/SerializerUtils.js';

// ---------------------------------------------------------------------------
// ensureArray()
// ---------------------------------------------------------------------------

void describe('ensureArray()', () => {
  void it('wraps a single value in an array', () => {
    const node: Record<string, unknown> = { 'label': 'Person' };

    ensureArray(node, 'label');
    assert.deepEqual(node.label, ['Person']);
  });

  void it('leaves an existing array unchanged', () => {
    const node: Record<string, unknown> = {
      'label': [
        'Person',
        'Human'
      ]
    };

    ensureArray(node, 'label');
    assert.deepEqual(node.label, [
      'Person',
      'Human'
    ]);
  });

  void it('no-op when key is undefined', () => {
    const node: Record<string, unknown> = { 'label': 'Person' };

    ensureArray(node, 'missing');
    assert.equal(node.missing, undefined);
    assert.equal(node.label, 'Person');
  });

  void it('handles empty object', () => {
    const node: Record<string, unknown> = {};

    ensureArray(node, 'any');
    assert.deepEqual(node, {});
  });
});

// ---------------------------------------------------------------------------
// normalizeArrays()
// ---------------------------------------------------------------------------

void describe('normalizeArrays()', () => {
  void it('wraps value at specified key in array', () => {
    const node: Record<string, unknown> = { 'label': 'Person' };

    normalizeArrays(node, ['label']);
    assert.deepEqual(node.label, ['Person']);
  });

  void it('handles multiple keys', () => {
    const node: Record<string, unknown> = {
      'comment': 'A person',
      'label': 'Person'
    };

    normalizeArrays(node, [
      'label',
      'comment'
    ]);
    assert.deepEqual(node.label, ['Person']);
    assert.deepEqual(node.comment, ['A person']);
  });

  void it('recursively processes nested objects', () => {
    const node: Record<string, unknown> = {
      'child': { 'label': 'Nested' },
      'label': 'Root'
    };

    normalizeArrays(node, ['label']);
    assert.deepEqual(node.label, ['Root']);
    assert.deepEqual((node.child as Record<string, unknown>).label, ['Nested']);
  });

  void it('recursively processes arrays of objects', () => {
    const node: Record<string, unknown> = {
      'items': [
        { 'label': 'First' },
        { 'label': 'Second' }
      ]
    };

    normalizeArrays(node, ['label']);
    assert.deepEqual((node.items as Array<Record<string, unknown>>)[0].label, ['First']);
    assert.deepEqual((node.items as Array<Record<string, unknown>>)[1].label, ['Second']);
  });

  void it('leaves non-matching keys unchanged', () => {
    const node: Record<string, unknown> = {
      'label': 'Person',
      'name': 'Alice'
    };

    normalizeArrays(node, ['label']);
    assert.deepEqual(node.label, ['Person']);
    assert.equal(node.name, 'Alice');
  });

  void it('handles null input gracefully', () => {
    normalizeArrays(null, ['label']);
    // no throw — void function returns silently
  });

  void it('handles primitive input gracefully', () => {
    normalizeArrays('string', ['label']);
    normalizeArrays(42, ['label']);
    normalizeArrays(true, ['label']);
    // no throw — void function returns silently
  });
});
