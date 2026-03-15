/**
 * Operations tests — applyOp and clone primitives
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOp, clone
} from '../../src/modules/data/operations.js';

// ---------------------------------------------------------------------------
// applyOp
// ---------------------------------------------------------------------------

void describe('applyOp()', () => {
  void it('set at root replaces the whole value', () => {
    const result = applyOp({ 'a': 1 }, {
      'op': 'set',
      'path': '/',
      'value': { 'b': 2 }
    });

    assert.deepEqual(result, { 'b': 2 });
  });

  void it('del at root returns undefined', () => {
    const result = applyOp({ 'a': 1 }, {
      'op': 'delete',
      'path': '/'
    });

    assert.equal(result, undefined);
  });

  void it('set at nested path sets the value', () => {
    const result = applyOp(
      {
        'user': {
          'age': 30,
          'name': 'Alice'
        }
      },
      {
        'op': 'set',
        'path': '/user/name',
        'value': 'Bob'
      }
    ) as { 'user': { 'age': number
      'name': string; } };

    assert.equal(result.user.name, 'Bob');
    assert.equal(result.user.age, 30);
  });

  void it('del at nested path deletes the property', () => {
    const result = applyOp(
      {
        'user': {
          'age': 30,
          'name': 'Alice'
        }
      },
      {
        'op': 'delete',
        'path': '/user/age'
      }
    ) as { 'user': Record<string, unknown> };

    assert.equal(result.user.name, 'Alice');
    assert.equal('age' in result.user, false);
  });

  void it('del with array path splices elements', () => {
    const result = applyOp(
      {
        'items': [
          'a',
          'b',
          'c'
        ]
      },
      {
        'op': 'delete',
        'path': '/items/1'
      }
    ) as { 'items': string[] };

    assert.deepEqual(result.items, [
      'a',
      'c'
    ]);
  });

  void it('set at a single-segment path sets property on object', () => {
    const result = applyOp({ 'x': 1 }, {
      'op': 'set',
      'path': '/x',
      'value': 99
    }) as Record<string, unknown>;

    assert.equal(result.x, 99);
  });

  void it('del at a single-segment path removes property', () => {
    const result = applyOp({
      'x': 1,
      'y': 2
    }, {
      'op': 'delete',
      'path': '/x'
    }) as Record<string, unknown>;

    assert.equal('x' in result, false);
    assert.equal(result.y, 2);
  });

  void it('does not mutate the original object', () => {
    const original = { 'a': { 'b': 1 } };

    applyOp(original, {
      'op': 'set',
      'path': '/a/b',
      'value': 2
    });

    assert.equal(original.a.b, 1);
  });

  void it('does not mutate the original array', () => {
    const original = {
      'items': [
        1,
        2,
        3
      ]
    };

    applyOp(original, {
      'op': 'delete',
      'path': '/items/0'
    });

    assert.deepEqual(original.items, [
      1,
      2,
      3
    ]);
  });

  void it('set adds a new property on an object', () => {
    const result = applyOp({ 'a': 1 }, {
      'op': 'set',
      'path': '/b',
      'value': 2
    }) as Record<string, unknown>;

    assert.equal(result.a, 1);
    assert.equal(result.b, 2);
  });
});

// ---------------------------------------------------------------------------
// clone
// ---------------------------------------------------------------------------

void describe('clone()', () => {
  void it('produces a deep copy via structuredClone', () => {
    const obj = {
      'a': 1,
      'b': {
        'c': [
          2,
          3
        ]
      }
    };
    const copy = clone(obj);

    assert.deepEqual(copy, obj);
    assert.notEqual(copy, obj);
    assert.notEqual(copy.b, obj.b);
    assert.notEqual(copy.b.c, obj.b.c);
  });

  void it('result is independent of original', () => {
    const obj = { 'x': { 'y': 1 } };
    const copy = clone(obj);

    copy.x.y = 999;

    assert.equal(obj.x.y, 1);
  });

  void it('clones primitives', () => {
    assert.equal(clone(42), 42);
    assert.equal(clone('hello'), 'hello');
    assert.equal(clone(true), true);
    assert.equal(clone(null), null);
  });

  void it('clones arrays', () => {
    const arr = [
      1,
      [
        2,
        3
      ]
    ];
    const copy = clone(arr);

    assert.deepEqual(copy, arr);
    assert.notEqual(copy, arr);
    assert.notEqual(copy[1], arr[1]);
  });
});
