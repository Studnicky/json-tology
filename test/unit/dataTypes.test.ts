import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  deepEqual,
  deepFreeze,
  isPlainObject,
  isRecord
} from '../../src/modules/data/DataTypes.js';

void describe('isRecord', () => {
  void it('returns true for a plain object', () => {
    assert.equal(isRecord({ 'a': 1 }), true);
  });

  void it('returns true for an empty object', () => {
    assert.equal(isRecord({}), true);
  });

  void it('returns false for null', () => {
    assert.equal(isRecord(null), false);
  });

  void it('returns false for an array', () => {
    assert.equal(isRecord([
      1,
      2
    ]), false);
  });

  void it('returns false for a string', () => {
    assert.equal(isRecord('hello'), false);
  });

  void it('returns false for undefined', () => {
    assert.equal(isRecord(), false);
  });
});

void describe('isPlainObject', () => {
  void it('returns true for an empty object literal', () => {
    assert.equal(isPlainObject({}), true);
  });

  void it('returns true for an object with properties', () => {
    assert.equal(isPlainObject({ 'x': 1 }), true);
  });

  void it('returns true for Object.create(null)', () => {
    assert.equal(isPlainObject(Object.create(null)), true);
  });

  void it('returns false for an array', () => {
    assert.equal(isPlainObject([
      1,
      2
    ]), false);
  });

  void it('returns false for a Date instance', () => {
    assert.equal(isPlainObject(new Date()), false);
  });

  void it('returns false for null', () => {
    assert.equal(isPlainObject(null), false);
  });

  void it('returns false for a class instance', () => {
    class Foo {}
    assert.equal(isPlainObject(new Foo()), false);
  });
});

void describe('deepEqual', () => {
  void it('returns true for equal primitives', () => {
    assert.equal(deepEqual(42, 42), true);
    assert.equal(deepEqual('abc', 'abc'), true);
    assert.equal(deepEqual(true, true), true);
  });

  void it('returns true for identical references', () => {
    const obj = { 'a': 1 };

    assert.equal(deepEqual(obj, obj), true);
  });

  void it('returns true for structurally equal objects', () => {
    assert.equal(deepEqual({
      'a': 1,
      'b': 'x'
    }, {
      'a': 1,
      'b': 'x'
    }), true);
  });

  void it('returns false for unequal objects', () => {
    assert.equal(deepEqual({ 'a': 1 }, { 'a': 2 }), false);
  });

  void it('returns false for objects with different keys', () => {
    assert.equal(deepEqual({ 'a': 1 }, { 'b': 1 }), false);
  });

  void it('returns true for equal arrays', () => {
    assert.equal(deepEqual([
      1,
      2,
      3
    ], [
      1,
      2,
      3
    ]), true);
  });

  void it('returns false for arrays of different length', () => {
    assert.equal(deepEqual([
      1,
      2
    ], [
      1,
      2,
      3
    ]), false);
  });

  void it('handles nested equality', () => {
    const left = {
      'a': {
        'b': [
          1,
          { 'c': 2 }
        ]
      }
    };
    const right = {
      'a': {
        'b': [
          1,
          { 'c': 2 }
        ]
      }
    };

    assert.equal(deepEqual(left, right), true);
  });

  void it('returns false when one side is null', () => {
    assert.equal(deepEqual(null, { 'a': 1 }), false);
    assert.equal(deepEqual({ 'a': 1 }, null), false);
  });

  void it('returns true when both sides are null', () => {
    assert.equal(deepEqual(null, null), true);
  });

  void it('returns false for different types', () => {
    assert.equal(deepEqual(1, '1'), false);
  });
});

void describe('deepFreeze', () => {
  void it('freezes the top-level object', () => {
    const obj = { 'a': 1 };

    deepFreeze(obj);
    assert.equal(Object.isFrozen(obj), true);
  });

  void it('freezes nested objects', () => {
    const obj = { 'nested': { 'value': 42 } };

    deepFreeze(obj);
    assert.equal(Object.isFrozen(obj.nested), true);
  });

  void it('freezes deeply nested structures', () => {
    const obj = { 'a': { 'b': { 'c': 3 } } };

    deepFreeze(obj);
    assert.equal(Object.isFrozen(obj.a.b), true);
  });

  void it('returns the same reference', () => {
    const obj = { 'x': 1 };
    const result = deepFreeze(obj);

    assert.equal(result, obj);
  });
});
