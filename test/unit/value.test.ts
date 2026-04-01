/**
 * Value utility tests — clone, hash, diff, patch, cast, clean
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/schemaRegistry.js';
import { Value } from '../../src/modules/data/value.js';
import { Changeset } from '../../src/modules/data/changeset.js';

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

void describe('Value.create()', () => {
  void it('creates primitive type defaults', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:string',
      'type': 'string'
    } as const);
    registry.register({
      '$id': 'urn:test:number',
      'type': 'number'
    } as const);
    registry.register({
      '$id': 'urn:test:integer',
      'type': 'integer'
    } as const);
    registry.register({
      '$id': 'urn:test:boolean',
      'type': 'boolean'
    } as const);
    registry.register({
      '$id': 'urn:test:null',
      'type': 'null'
    } as const);
    registry.register({
      '$id': 'urn:test:array',
      'items': { 'type': 'string' },
      'type': 'array'
    } as const);
    const value = new Value(registry);

    assert.equal(value.create('urn:test:string'), '');
    assert.equal(value.create('urn:test:number'), 0);
    assert.equal(value.create('urn:test:integer'), 0);
    assert.equal(value.create('urn:test:boolean'), false);
    assert.equal(value.create('urn:test:null'), null);
    assert.deepEqual(value.create('urn:test:array'), []);
  });

  void it('creates object with nested defaults', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:nested-inner',
      'properties': {
        'flag': {
          'default': true,
          'type': 'boolean'
        }
      },
      'type': 'object'
    } as const);
    registry.register({
      '$id': 'urn:test:nested-object',
      'properties': {
        'age': { 'type': 'number' },
        'name': {
          'default': 'anonymous',
          'type': 'string'
        },
        'nested': { '$ref': 'urn:test:nested-inner' }
      },
      'required': [
        'age',
        'nested'
      ],
      'type': 'object'
    } as const);
    const value = new Value(registry);
    const result = value.create('urn:test:nested-object') as Record<string, unknown>;

    assert.equal(result.name, 'anonymous');
    assert.equal(result.age, 0);
    assert.deepEqual(result.nested, { 'flag': true });
  });

  void it('honors explicit defaults, const, and enum values', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:string-default',
      'default': 'hello',
      'type': 'string'
    } as const);
    registry.register({
      '$id': 'urn:test:number-default',
      'default': 42,
      'type': 'number'
    } as const);
    registry.register({
      '$id': 'urn:test:const',
      'const': 'fixed'
    } as const);
    registry.register({
      '$id': 'urn:test:enum',
      'enum': [
        'a',
        'b',
        'c'
      ]
    } as const);
    const value = new Value(registry);

    assert.equal(value.create('urn:test:string-default'), 'hello');
    assert.equal(value.create('urn:test:number-default'), 42);
    assert.equal(value.create('urn:test:const'), 'fixed');
    assert.equal(value.create('urn:test:enum'), 'a');
  });

  void it('creates required properties even without defaults, returns null for no-type schemas', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'urn:test:required-props',
      'properties': {
        'id': { 'type': 'string' },
        'optional': { 'type': 'number' }
      },
      'required': ['id'],
      'type': 'object'
    } as const);
    registry.register({ '$id': 'urn:test:empty' } as const);
    const value = new Value(registry);

    const result = value.create('urn:test:required-props') as Record<string, unknown>;

    assert.equal(result.id, '');
    assert.equal('optional' in result, false);
    assert.equal(value.create('urn:test:empty'), null);
  });
});

// ---------------------------------------------------------------------------
// clone + hash
// ---------------------------------------------------------------------------

void describe('Value.clone() and Value.hash()', () => {
  void it('clone produces deep copies of objects and arrays', () => {
    const obj = {
      'a': 1,
      'b': { 'c': 2 }
    };
    const copy = Value.clone(obj);

    assert.deepEqual(copy, obj);
    assert.notEqual(copy, obj);
    assert.notEqual(copy.b, obj.b);

    const arr = [
      1,
      [
        2,
        3
      ]
    ];
    const arrCopy = Value.clone(arr);

    assert.deepEqual(arrCopy, arr);
    assert.notEqual(arrCopy, arr);

    // Primitives pass through
    assert.equal(Value.clone(42), 42);
    assert.equal(Value.clone('hello'), 'hello');
    assert.equal(Value.clone(true), true);
    assert.equal(Value.clone(null), null);
  });

  void it('hash is deterministic, order-independent, and type-sensitive', () => {
    assert.equal(typeof Value.hash({ 'a': 1 }), 'string');
    assert.equal(Value.hash({
      'a': 1,
      'b': 2
    }), Value.hash({
      'a': 1,
      'b': 2
    }));
    assert.notEqual(Value.hash({ 'a': 1 }), Value.hash({ 'a': 2 }));
    assert.equal(Value.hash(42), Value.hash(42));
    assert.notEqual(Value.hash(42), Value.hash('42'));
  });
});

// ---------------------------------------------------------------------------
// diff / patch
// ---------------------------------------------------------------------------

void describe('Value.diff() -> Changeset', () => {
  void it('detects set, delete, and add operations', () => {
    // isEmpty
    assert.equal(Value.diff({ 'a': 1 }, { 'a': 1 }).isEmpty, true);
    assert.equal(Value.diff({ 'a': 1 }, { 'a': 1 }).length, 0);

    // set op for changed value
    const csSet = Value.diff({ 'a': 1 }, { 'a': 2 });

    assert.equal(csSet.length, 1);
    assert.equal(csSet.operations[0].op, 'set');
    assert.equal(csSet.operations[0].path, '/a');
    assert.equal((csSet.operations[0] as { 'value': unknown }).value, 2);

    // delete op for removed key
    const csDel = Value.diff({
      'a': 1,
      'b': 2
    }, { 'a': 1 });

    assert.equal(csDel.length, 1);
    assert.equal(csDel.operations[0].op, 'delete');
    assert.equal(csDel.operations[0].path, '/b');

    // set op for added key
    const csAdd = Value.diff({ 'a': 1 }, {
      'a': 1,
      'b': 2
    });

    assert.equal(csAdd.operations[0].op, 'set');
    assert.equal(csAdd.operations[0].path, '/b');

    // nested changes
    const csNested = Value.diff({ 'user': { 'name': 'Alice' } }, { 'user': { 'name': 'Bob' } });

    assert.equal(csNested.operations[0].path, '/user/name');
  });

  void it('changeset transforms a into b without mutation, round-trips correctly', () => {
    const source = {
      'name': 'Alice',
      'role': 'user'
    };
    const target = { 'name': 'Bob' };
    const changeset = Value.diff(source, target);
    let patched: unknown = Value.clone(source);

    for (const operation of changeset.operations) {
      patched = Value.applyOp(patched, operation);
    }

    assert.deepEqual(patched, target);

    // does not mutate original
    const orig = { 'x': 1 };
    const origChangeset = Value.diff(orig, { 'x': 2 });
    let origPatched: unknown = Value.clone(orig);

    for (const operation of origChangeset.operations) {
      origPatched = Value.applyOp(origPatched, operation);
    }

    assert.equal(orig.x, 1);

    // round-trip with nested changes
    const before = {
      'x': 1,
      'y': 2,
      'z': { 'w': 3 }
    };
    const after = {
      'x': 10,
      'z': {
        'q': 4,
        'w': 99
      }
    };
    const nestedChangeset = Value.diff(before, after);
    let nestedPatched: unknown = Value.clone(before);

    for (const operation of nestedChangeset.operations) {
      nestedPatched = Value.applyOp(nestedPatched, operation);
    }

    assert.deepEqual(nestedPatched, after);
  });
});

// ---------------------------------------------------------------------------
// cast
// ---------------------------------------------------------------------------

void describe('Value.cast()', () => {
  const registry = new SchemaRegistry();

  registry.register({
    '$id': 'urn:test:number',
    'type': 'number'
  } as const);
  registry.register({
    '$id': 'urn:test:string',
    'type': 'string'
  } as const);
  registry.register({
    '$id': 'urn:test:boolean',
    'type': 'boolean'
  } as const);
  registry.register({
    '$id': 'urn:test:item',
    'properties': {
      'count': { 'type': 'integer' },
      'flag': { 'type': 'boolean' },
      'name': { 'type': 'string' },
      'score': {
        'default': 0,
        'type': 'number'
      }
    },
    'type': 'object'
  } as const);
  registry.register({
    '$defs': {
      'metrics': {
        'properties': {
          'count': {
            'default': 0,
            'type': 'integer'
          }
        },
        'type': 'object'
      }
    },
    '$id': 'urn:test:ref-metrics',
    'properties': { 'metrics': { '$ref': '#/$defs/metrics' } },
    'type': 'object'
  } as const);
  const value = new Value(registry);

  void it('coerces primitives and fills object defaults', () => {
    assert.equal(value.cast('urn:test:number', '42'), 42);
    assert.equal(value.cast('urn:test:string', 123), '123');
    assert.equal(value.cast('urn:test:boolean', 'true'), true);

    const castResult = value.cast('urn:test:item', { 'name': 'Widget' }) as Record<string, unknown>;

    assert.equal(castResult.score, 0);

    const castResult2 = value.cast('urn:test:item', {
      'count': '5',
      'name': 'Widget'
    }) as Record<string, unknown>;

    assert.equal(castResult2.count, 5);

    assert.ok(typeof value.cast('urn:test:item', null) === 'object');
  });

  void it('uses graph-engine ref resolution for nested defaults and coercion', () => {
    const castResult = value.cast('urn:test:ref-metrics', { 'metrics': { 'count': '5' } }) as Record<string, Record<string, unknown>>;

    assert.equal(castResult.metrics.count, 5);
    assert.deepEqual(value.cast('urn:test:ref-metrics', {}) as Record<string, unknown>, { 'metrics': { 'count': 0 } });
  });
});

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

void describe('Value.clean()', () => {
  const registry = new SchemaRegistry();

  registry.register({
    '$id': 'urn:test:address',
    'properties': { 'street': { 'type': 'string' } },
    'type': 'object'
  } as const);
  registry.register({
    '$id': 'urn:test:user',
    'properties': {
      'address': { '$ref': 'urn:test:address' },
      'email': { 'type': 'string' },
      'name': { 'type': 'string' }
    },
    'type': 'object'
  } as const);
  const value = new Value(registry);

  void it('removes undeclared properties, preserves declared, recurses, and does not mutate', () => {
    const cleanResult = value.clean('urn:test:user', {
      'email': 'a@b.com',
      'name': 'Alice',
      'secret': 'x'
    }) as Record<string, unknown>;

    assert.ok(!('secret' in cleanResult));
    assert.equal(cleanResult.name, 'Alice');
    assert.equal(cleanResult.email, 'a@b.com');

    const cleanResult2 = value.clean('urn:test:user', {
      'address': {
        'hack': 'x',
        'street': '1 Main St'
      },
      'name': 'Alice'
    }) as Record<string, Record<string, unknown>>;

    assert.ok(!('hack' in cleanResult2.address));
    assert.equal(cleanResult2.address.street, '1 Main St');

    const input = {
      'name': 'Alice',
      'secret': 'x'
    };

    value.clean('urn:test:user', input);
    assert.ok('secret' in input);
  });
});

// ---------------------------------------------------------------------------
// applyOp edge cases (folded from operations.test.ts)
// ---------------------------------------------------------------------------

void describe('Value.applyOp() edge cases', () => {
  void it('handles root-level set/delete and array splice', () => {
    // set at root replaces the whole value
    assert.deepEqual(Value.applyOp({ 'a': 1 }, {
      'op': 'set',
      'path': '/',
      'value': { 'b': 2 }
    }), { 'b': 2 });

    // delete at root returns undefined
    assert.equal(Value.applyOp({ 'a': 1 }, {
      'op': 'delete',
      'path': '/'
    }), undefined);

    // delete with array path splices elements
    const spliced = Value.applyOp({
      'items': [
        'a',
        'b',
        'c'
      ]
    }, {
      'op': 'delete',
      'path': '/items/1'
    }) as { 'items': string[] };

    assert.deepEqual(spliced.items, [
      'a',
      'c'
    ]);

    // does not mutate original array
    const original = {
      'items': [
        1,
        2,
        3
      ]
    };

    Value.applyOp(original, {
      'op': 'delete',
      'path': '/items/0'
    });
    assert.deepEqual(original.items, [
      1,
      2,
      3
    ]);
  });
});

// ---------------------------------------------------------------------------
// Changeset (folded from changeset.test.ts)
// ---------------------------------------------------------------------------

/* eslint-disable no-restricted-syntax -- Changeset.apply() is not Function.prototype.apply() */
void describe('Changeset', () => {
  void it('apply() modifies, deletes, and chains operations without mutation', () => {
    const cs = new Changeset([
      {
        'op': 'set',
        'path': '/name',
        'value': 'Bob'
      },
      {
        'op': 'delete',
        'path': '/age'
      }
    ]);
    const original = {
      'age': 30,
      'name': 'Alice'
    };
    const result = cs.apply(original) as Record<string, unknown>;

    assert.equal(result.name, 'Bob');
    assert.equal('age' in result, false);
    assert.equal(original.name, 'Alice');
    assert.equal(original.age, 30);

    // Nested paths
    const cs2 = new Changeset([{
      'op': 'set',
      'path': '/address/city',
      'value': 'Portland'
    }]);
    const result2 = cs2.apply({
      'address': {
        'city': 'Seattle',
        'zip': '98101'
      }
    }) as { 'address': Record<string, unknown> };

    assert.equal(result2.address.city, 'Portland');
    assert.equal(result2.address.zip, '98101');

    // Chaining multiple operations
    const cs3 = new Changeset([
      {
        'op': 'set',
        'path': '/x',
        'value': 10
      },
      {
        'op': 'set',
        'path': '/y',
        'value': 20
      },
      {
        'op': 'delete',
        'path': '/z'
      }
    ]);
    const result3 = cs3.apply({
      'x': 1,
      'y': 2,
      'z': 3
    }) as Record<string, unknown>;

    assert.equal(result3.x, 10);
    assert.equal(result3.y, 20);
    assert.equal('z' in result3, false);
  });

  void it('isEmpty, length, and operations are correct', () => {
    assert.equal(new Changeset([]).isEmpty, true);
    assert.equal(new Changeset([]).length, 0);

    const cs = new Changeset([
      {
        'op': 'set',
        'path': '/a',
        'value': 1
      },
      {
        'op': 'delete',
        'path': '/b'
      }
    ]);

    assert.equal(cs.isEmpty, false);
    assert.equal(cs.length, 2);
    assert.equal(cs.operations[0].op, 'set');
    assert.equal(cs.operations[1].op, 'delete');
  });
});

// ---------------------------------------------------------------------------
// Value.diff() with arrays
// ---------------------------------------------------------------------------

void describe('Value.diff() -> Changeset (arrays)', () => {
  void it('detects added, removed, and modified array items', () => {
    // Modified items
    const cs1 = Value.diff({
      'items': [
        1,
        2,
        3
      ]
    }, {
      'items': [
        1,
        99,
        3
      ]
    });

    assert.equal(cs1.isEmpty, false);
    assert.equal(cs1.operations.some((op) => {
      return op.path === '/items/1' && op.op === 'set' && op.value === 99;
    }), true);

    // Added items (array grew)
    const cs2 = Value.diff({ 'items': ['a'] }, {
      'items': [
        'a',
        'b',
        'c'
      ]
    });
    const setOps = cs2.operations.filter((op) => {
      return op.op === 'set';
    });

    assert.ok(setOps.some((op) => {
      return op.path === '/items/1' && op.value === 'b';
    }));
    assert.ok(setOps.some((op) => {
      return op.path === '/items/2' && op.value === 'c';
    }));

    // Removed items (array shrank)
    const cs3 = Value.diff({
      'items': [
        1,
        2,
        3
      ]
    }, { 'items': [1] });
    const delOps = cs3.operations.filter((op) => {
      return op.op === 'delete';
    });

    assert.ok(delOps.some((op) => {
      return op.path === '/items/1';
    }));
    assert.ok(delOps.some((op) => {
      return op.path === '/items/2';
    }));

    // Identical arrays produce empty changeset
    const cs4 = Value.diff({
      'items': [
        1,
        2
      ]
    }, {
      'items': [
        1,
        2
      ]
    });

    assert.equal(cs4.isEmpty, true);
  });
});
