import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Value } from '../../src/index.js';

const {
  applyOp, clone
} = Value;

void describe('clone — Good/Bad/Ugly', () => {
  void it('clones objects, arrays, and primitives with structural isolation', () => {
    // Good: deep clones an object
    const original = {
      'a': 1,
      'b': { 'c': 2 }
    };
    const cloned = clone(original);

    assert.deepStrictEqual(cloned, original);
    assert.notEqual(cloned, original);
    assert.notEqual((cloned).b, original.b);

    // Good: deep clones an array
    const arr = [
      1,
      [
        2,
        3
      ],
      { 'x': 4 }
    ];
    const arrCloned = clone(arr);

    assert.deepStrictEqual(arrCloned, arr);
    assert.notEqual(arrCloned, arr);
    assert.notEqual((arrCloned)[1], arr[1]);

    // Bad/Ugly: handles primitives unchanged
    assert.equal(clone(42), 42);
    assert.equal(clone('hello'), 'hello');
    assert.equal(clone(true), true);
    assert.equal(clone(null), null);
  });
});

void describe('applyOp set — Good/Bad/Ugly', () => {
  void it('sets values at various paths immutably', () => {
    // Good: sets top-level path
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

    // Good: does not mutate original
    applyOp(root, {
      'op': 'set',
      'path': '/a',
      'value': 99
    });
    assert.equal(root.a, 1);

    // Good: sets at nested path
    const nested = { 'address': { 'city': 'Boston' } };
    const nestedResult = applyOp(nested, {
      'op': 'set',
      'path': '/address/city',
      'value': 'Denver'
    });

    assert.deepStrictEqual(nestedResult, { 'address': { 'city': 'Denver' } });
    assert.equal(nested.address.city, 'Boston');

    // Bad: replaces root when path is /
    const rootResult = applyOp({ 'a': 1 }, {
      'op': 'set',
      'path': '/',
      'value': 'replaced'
    });

    assert.equal(rootResult, 'replaced');

    // Ugly: adds a new key at top-level path
    const addResult = applyOp({ 'a': 1 }, {
      'op': 'set',
      'path': '/b',
      'value': 2
    });

    assert.deepStrictEqual(addResult, {
      'a': 1,
      'b': 2
    });
  });
});

void describe('applyOp delete — Good/Bad/Ugly', () => {
  void it('deletes keys at various paths immutably', () => {
    // Good: removes a top-level key
    const root = {
      'a': 1,
      'b': 2
    };
    const result = applyOp(root, {
      'op': 'delete',
      'path': '/a'
    });

    assert.deepStrictEqual(result, { 'b': 2 });

    // Good: does not mutate original
    assert.equal(root.a, 1);

    // Good: removes a nested key
    const nested = {
      'address': {
        'city': 'Boston',
        'zip': '02101'
      }
    };
    const nestedResult = applyOp(nested, {
      'op': 'delete',
      'path': '/address/zip'
    });

    assert.deepStrictEqual(nestedResult, { 'address': { 'city': 'Boston' } });

    // Bad: returns undefined when deleting root
    const rootResult = applyOp({ 'a': 1 }, {
      'op': 'delete',
      'path': '/'
    });

    assert.equal(rootResult, undefined);

    // Ugly: splices an array element by index
    const arrRoot = {
      'items': [
        'a',
        'b',
        'c'
      ]
    };
    const arrResult = applyOp(arrRoot, {
      'op': 'delete',
      'path': '/items/1'
    }) as { 'items': string[] };

    assert.deepStrictEqual(arrResult.items, [
      'a',
      'c'
    ]);
  });
});
