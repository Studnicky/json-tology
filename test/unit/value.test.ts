/**
 * Value utility tests — clone, hash, diff, patch, cast, clean
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Value } from '../../src/modules/data/Value.js';

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('Value.create()', () => {
  it('creates primitive type defaults', () => {
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

  it('creates object with nested defaults', () => {
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

  it('honors explicit defaults, const, and enum values', () => {
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

  it('creates required properties even without defaults, returns null for no-type schemas', () => {
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

describe('Value.clone() and Value.hash()', () => {
  it('clone produces deep copies of objects and arrays', () => {
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
  });

  it('hash is deterministic, order-independent, and type-sensitive', () => {
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

describe('Value.diff() → Changeset', () => {
  it('detects set, delete, and add operations', () => {
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

  it('apply() transforms a into b without mutation, round-trips correctly', () => {
    const a = {
      'name': 'Alice',
      'role': 'user'
    };
    const b = { 'name': 'Bob' };

    assert.deepEqual(Value.diff(a, b).apply(a), b);

    // does not mutate original
    const orig = { 'x': 1 };

    Value.diff(orig, { 'x': 2 }).apply(orig);
    assert.equal(orig.x, 1);

    // round-trip with nested changes
    const c = {
      'x': 1,
      'y': 2,
      'z': { 'w': 3 }
    };
    const d = {
      'x': 10,
      'z': {
        'q': 4,
        'w': 99
      }
    };

    assert.deepEqual(Value.diff(c, d).apply(c), d);
  });
});

// ---------------------------------------------------------------------------
// cast
// ---------------------------------------------------------------------------

describe('Value.cast()', () => {
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

  it('coerces primitives and fills object defaults', () => {
    assert.equal(value.cast('urn:test:number', '42'), 42);
    assert.equal(value.cast('urn:test:string', 123), '123');
    assert.equal(value.cast('urn:test:boolean', 'true'), true);

    const r = value.cast('urn:test:item', { 'name': 'Widget' }) as Record<string, unknown>;

    assert.equal(r.score, 0);

    const r2 = value.cast('urn:test:item', {
      'count': '5',
      'name': 'Widget'
    }) as Record<string, unknown>;

    assert.equal(r2.count, 5);

    assert.ok(typeof value.cast('urn:test:item', null) === 'object');
  });

  it('uses graph-engine ref resolution for nested defaults and coercion', () => {
    const r = value.cast('urn:test:ref-metrics', { 'metrics': { 'count': '5' } }) as Record<string, Record<string, unknown>>;

    assert.equal(r.metrics.count, 5);
    assert.deepEqual(value.cast('urn:test:ref-metrics', {}) as Record<string, unknown>, { 'metrics': { 'count': 0 } });
  });
});

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

describe('Value.clean()', () => {
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

  it('removes undeclared properties, preserves declared, recurses, and does not mutate', () => {
    const r = value.clean('urn:test:user', {
      'email': 'a@b.com',
      'name': 'Alice',
      'secret': 'x'
    }) as Record<string, unknown>;

    assert.ok(!('secret' in r));
    assert.equal(r.name, 'Alice');
    assert.equal(r.email, 'a@b.com');

    const r2 = value.clean('urn:test:user', {
      'address': {
        'hack': 'x',
        'street': '1 Main St'
      },
      'name': 'Alice'
    }) as Record<string, Record<string, unknown>>;

    assert.ok(!('hack' in r2.address));
    assert.equal(r2.address.street, '1 Main St');

    const input = {
      'name': 'Alice',
      'secret': 'x'
    };

    value.clean('urn:test:user', input);
    assert.ok('secret' in input);
  });
});
