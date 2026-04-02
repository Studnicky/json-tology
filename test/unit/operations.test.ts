import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import {
  applyOp, clone
} from '../../src/modules/data/Operations.js';

void describe('clone', () => {
  void it('deep clones an object', () => {
    const original = {
      'a': 1,
      'b': { 'c': 2 }
    };
    const cloned = clone(original);

    assert.deepStrictEqual(cloned, original);
    assert.notEqual(cloned, original);
    assert.notEqual(cloned.b, original.b);
  });

  void it('deep clones an array', () => {
    const original = [
      1,
      [
        2,
        3
      ],
      { 'x': 4 }
    ];
    const cloned = clone(original);

    assert.deepStrictEqual(cloned, original);
    assert.notEqual(cloned, original);
    assert.notEqual(cloned[1], original[1]);
  });

  void it('handles primitives', () => {
    assert.equal(clone(42), 42);
    assert.equal(clone('hello'), 'hello');
    assert.equal(clone(true), true);
    assert.equal(clone(null), null);
  });
});

void describe('applyOp', () => {
  void describe('set operation', () => {
    void it('sets a value at a top-level path', () => {
      const root = {
        'a': 1,
        'b': 2
      };
      const result = applyOp(root, {
        'op': 'set',
        'path': '/a',
        'value': 10
      });

      assert.deepStrictEqual(result, {
        'a': 10,
        'b': 2
      });
    });

    void it('does not mutate the original object', () => {
      const root = { 'a': 1 };

      applyOp(root, {
        'op': 'set',
        'path': '/a',
        'value': 99
      });
      assert.equal(root.a, 1);
    });

    void it('sets a value at a nested path', () => {
      const root = { 'address': { 'city': 'Boston' } };
      const result = applyOp(root, {
        'op': 'set',
        'path': '/address/city',
        'value': 'Denver'
      });

      assert.deepStrictEqual(result, { 'address': { 'city': 'Denver' } });
    });

    void it('does not mutate nested objects', () => {
      const root = { 'address': { 'city': 'Boston' } };

      applyOp(root, {
        'op': 'set',
        'path': '/address/city',
        'value': 'Denver'
      });
      assert.equal(root.address.city, 'Boston');
    });

    void it('replaces the root when path is /', () => {
      const result = applyOp({ 'a': 1 }, {
        'op': 'set',
        'path': '/',
        'value': 'replaced'
      });

      assert.equal(result, 'replaced');
    });

    void it('adds a new key at a top-level path', () => {
      const root = { 'a': 1 };
      const result = applyOp(root, {
        'op': 'set',
        'path': '/b',
        'value': 2
      });

      assert.deepStrictEqual(result, {
        'a': 1,
        'b': 2
      });
    });
  });

  void describe('delete operation', () => {
    void it('removes a top-level key', () => {
      const root = {
        'a': 1,
        'b': 2
      };
      const result = applyOp(root, {
        'op': 'delete',
        'path': '/a'
      });

      assert.deepStrictEqual(result, { 'b': 2 });
    });

    void it('does not mutate the original on delete', () => {
      const root = {
        'a': 1,
        'b': 2
      };

      applyOp(root, {
        'op': 'delete',
        'path': '/a'
      });
      assert.equal(root.a, 1);
    });

    void it('removes a nested key', () => {
      const root = {
        'address': {
          'city': 'Boston',
          'zip': '02101'
        }
      };
      const result = applyOp(root, {
        'op': 'delete',
        'path': '/address/zip'
      });

      assert.deepStrictEqual(result, { 'address': { 'city': 'Boston' } });
    });

    void it('returns undefined when deleting root', () => {
      const result = applyOp({ 'a': 1 }, {
        'op': 'delete',
        'path': '/'
      });

      assert.equal(result, undefined);
    });

    void it('splices an array element by index', () => {
      const root = {
        'items': [
          'a',
          'b',
          'c'
        ]
      };
      const result = applyOp(root, {
        'op': 'delete',
        'path': '/items/1'
      }) as { 'items': string[] };

      assert.deepStrictEqual(result.items, [
        'a',
        'c'
      ]);
    });
  });
});
