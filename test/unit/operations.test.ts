import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Operations } from '../../src/index.js';

void describe('Operations.clone — Good/Bad/Ugly', () => {
  void it('clones objects, arrays, and primitives with structural isolation', () => {
    // Good: deep clones an object
    const original = {
      'a': 1,
      'b': { 'c': 2 }
    };
    const cloned = Operations.clone(original);

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
    const arrCloned = Operations.clone(arr);

    assert.deepStrictEqual(arrCloned, arr);
    assert.notEqual(arrCloned, arr);
    assert.notEqual((arrCloned as unknown[][])[1], arr[1]);

    // Bad/Ugly: handles primitives unchanged
    assert.equal(Operations.clone(42), 42);
    assert.equal(Operations.clone('hello'), 'hello');
    assert.equal(Operations.clone(true), true);
    assert.equal(Operations.clone(null), null);
  });
});

void describe('Operations.patch set — Good/Bad/Ugly', () => {
  void it('sets values at various paths immutably', () => {
    // Good: sets top-level path
    const root = {
      'a': 1,
      'b': 2
    };
    const result = Operations.patch(root, {
      'op': 'set',
      'path': '/a',
      'value': 10
    });

    assert.deepStrictEqual(result, {
      'a': 10,
      'b': 2
    });

    // Good: does not mutate original
    Operations.patch(root, {
      'op': 'set',
      'path': '/a',
      'value': 99
    });
    assert.equal(root.a, 1);

    // Good: sets at nested path
    const nested = { 'address': { 'city': 'Boston' } };
    const nestedResult = Operations.patch(nested, {
      'op': 'set',
      'path': '/address/city',
      'value': 'Denver'
    });

    assert.deepStrictEqual(nestedResult, { 'address': { 'city': 'Denver' } });
    assert.equal(nested.address.city, 'Boston');

    // Bad: replaces root when path is /
    const rootResult = Operations.patch({ 'a': 1 }, {
      'op': 'set',
      'path': '/',
      'value': 'replaced'
    });

    assert.equal(rootResult, 'replaced');

    // Ugly: adds a new key at top-level path
    const addResult = Operations.patch({ 'a': 1 }, {
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

void describe('Operations.patch delete — Good/Bad/Ugly', () => {
  void it('deletes keys at various paths immutably', () => {
    // Good: removes a top-level key
    const root = {
      'a': 1,
      'b': 2
    };
    const result = Operations.patch(root, {
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
    const nestedResult = Operations.patch(nested, {
      'op': 'delete',
      'path': '/address/zip'
    });

    assert.deepStrictEqual(nestedResult, { 'address': { 'city': 'Boston' } });

    // Bad: returns undefined when deleting root
    const rootResult = Operations.patch({ 'a': 1 }, {
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
    const arrResult = Operations.patch(arrRoot, {
      'op': 'delete',
      'path': '/items/1'
    }) as { 'items': string[] };

    assert.deepStrictEqual(arrResult.items, [
      'a',
      'c'
    ]);
  });
});
