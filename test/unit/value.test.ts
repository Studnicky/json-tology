/**
 * Value utility tests — clone, hash, diff, patch, cast, clean
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { Value } from '../../src/modules/data/Value.js';

// ---------------------------------------------------------------------------
// create
// ---------------------------------------------------------------------------

describe('Value.create()', () => {
  it('creates string default', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:string', type: 'string' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:string'), '');
  });

  it('creates number default', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:number', type: 'number' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:number'), 0);
  });

  it('creates integer default', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:integer', type: 'integer' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:integer'), 0);
  });

  it('creates boolean default', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:boolean', type: 'boolean' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:boolean'), false);
  });

  it('creates null default', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:null', type: 'null' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:null'), null);
  });

  it('creates array default', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:array', type: 'array', items: { type: 'string' } } as const);
    const value = new Value(registry);
    assert.deepEqual(value.create('urn:test:array'), []);
  });

  it('creates object with nested defaults', () => {
    const registry = new SchemaRegistry();
    registry.register({
      $id: 'urn:test:nested-inner',
      type: 'object',
      properties: {
        flag: { type: 'boolean', default: true },
      },
    } as const);
    registry.register({
      $id: 'urn:test:nested-object',
      type: 'object',
      properties: {
        name: { type: 'string', default: 'anonymous' },
        age: { type: 'number' },
        nested: { $ref: 'urn:test:nested-inner' },
      },
      required: ['age', 'nested'],
    } as const);
    const value = new Value(registry);
    const result = value.create('urn:test:nested-object') as Record<string, unknown>;
    assert.equal(result['name'], 'anonymous');
    assert.equal(result['age'], 0);
    assert.deepEqual(result['nested'], { flag: true });
  });

  it('honors explicit default values', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:string-default', type: 'string', default: 'hello' } as const);
    registry.register({ $id: 'urn:test:number-default', type: 'number', default: 42 } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:string-default'), 'hello');
    assert.equal(value.create('urn:test:number-default'), 42);
  });

  it('honors const values', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:const', const: 'fixed' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:const'), 'fixed');
  });

  it('honors enum (picks first)', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:enum', enum: ['a', 'b', 'c'] } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:enum'), 'a');
  });

  it('creates required properties even without defaults', () => {
    const registry = new SchemaRegistry();
    registry.register({
      $id: 'urn:test:required-props',
      type: 'object',
      properties: {
        id: { type: 'string' },
        optional: { type: 'number' },
      },
      required: ['id'],
    } as const);
    const value = new Value(registry);
    const result = value.create('urn:test:required-props') as Record<string, unknown>;
    assert.equal(result['id'], '');
    assert.equal('optional' in result, false);
  });

  it('returns null for schema with no type', () => {
    const registry = new SchemaRegistry();
    registry.register({ $id: 'urn:test:empty' } as const);
    const value = new Value(registry);
    assert.equal(value.create('urn:test:empty'), null);
  });
});

// ---------------------------------------------------------------------------
// clone
// ---------------------------------------------------------------------------

describe('Value.clone()', () => {
  it('produces a deep copy', () => {
    const obj = { a: 1, b: { c: 2 } };
    const copy = Value.clone(obj);
    assert.deepEqual(copy, obj);
    assert.notEqual(copy, obj);
    assert.notEqual(copy.b, obj.b);
  });

  it('clones arrays', () => {
    const arr = [1, [2, 3]];
    const copy = Value.clone(arr);
    assert.deepEqual(copy, arr);
    assert.notEqual(copy, arr);
  });
});

// ---------------------------------------------------------------------------
// hash
// ---------------------------------------------------------------------------

describe('Value.hash()', () => {
  it('returns a string', () => {
    assert.equal(typeof Value.hash({ a: 1 }), 'string');
  });

  it('same value produces same hash', () => {
    assert.equal(Value.hash({ a: 1, b: 2 }), Value.hash({ b: 2, a: 1 }));
  });

  it('different values produce different hashes', () => {
    assert.notEqual(Value.hash({ a: 1 }), Value.hash({ a: 2 }));
  });

  it('handles primitives', () => {
    assert.equal(Value.hash(42), Value.hash(42));
    assert.notEqual(Value.hash(42), Value.hash('42'));
  });
});

// ---------------------------------------------------------------------------
// diff / patch
// ---------------------------------------------------------------------------

describe('Value.diff() → Changeset', () => {
  it('isEmpty when values are equal', () => {
    assert.equal(Value.diff({ a: 1 }, { a: 1 }).isEmpty, true);
    assert.equal(Value.diff({ a: 1 }, { a: 1 }).length, 0);
  });

  it('set op for changed value', () => {
    const cs = Value.diff({ a: 1 }, { a: 2 });
    assert.equal(cs.length, 1);
    assert.equal(cs.operations[0].op, 'set');
    assert.equal(cs.operations[0].path, '/a');
    assert.equal((cs.operations[0] as { value: unknown }).value, 2);
  });

  it('delete op for removed key', () => {
    const cs = Value.diff({ a: 1, b: 2 }, { a: 1 });
    assert.equal(cs.length, 1);
    assert.equal(cs.operations[0].op, 'delete');
    assert.equal(cs.operations[0].path, '/b');
  });

  it('set op for added key', () => {
    const cs = Value.diff({ a: 1 }, { a: 1, b: 2 });
    assert.equal(cs.operations[0].op, 'set');
    assert.equal(cs.operations[0].path, '/b');
  });

  it('nested changes', () => {
    const cs = Value.diff({ user: { name: 'Alice' } }, { user: { name: 'Bob' } });
    assert.equal(cs.operations[0].path, '/user/name');
  });

  it('.apply() transforms a into b', () => {
    const a = { name: 'Alice', role: 'user' };
    const b = { name: 'Bob' };
    assert.deepEqual(Value.diff(a, b).apply(a), b);
  });

  it('.apply() does not mutate original', () => {
    const a = { x: 1 };
    Value.diff(a, { x: 2 }).apply(a);
    assert.equal(a.x, 1);
  });

  it('round-trip: diff(a,b).apply(a) equals b', () => {
    const a = { x: 1, y: 2, z: { w: 3 } };
    const b = { x: 10,     z: { w: 99, q: 4 } };
    assert.deepEqual(Value.diff(a, b).apply(a), b);
  });
});

// ---------------------------------------------------------------------------
// cast
// ---------------------------------------------------------------------------

describe('Value.cast()', () => {
  const registry = new SchemaRegistry();
  registry.register({
    $id: 'urn:test:number',
    type: 'number',
  } as const);
  registry.register({
    $id: 'urn:test:string',
    type: 'string',
  } as const);
  registry.register({
    $id: 'urn:test:boolean',
    type: 'boolean',
  } as const);
  registry.register({
    $id: 'urn:test:item',
    type: 'object',
    properties: {
      name:  { type: 'string' },
      count: { type: 'integer' },
      flag:  { type: 'boolean' },
      score: { type: 'number', default: 0 },
    },
  } as const);
  registry.register({
    $id: 'urn:test:ref-metrics',
    '$defs': {
      'metrics': {
        'properties': {
          'count': { 'default': 0, 'type': 'integer' }
        },
        'type': 'object'
      }
    },
    'properties': {
      'metrics': { '$ref': '#/$defs/metrics' }
    },
    'type': 'object'
  } as const);
  const value = new Value(registry);

  it('coerces string to number', () => {
    const r = value.cast('urn:test:number', '42');
    assert.equal(r, 42);
  });

  it('coerces number to string', () => {
    const r = value.cast('urn:test:string', 123);
    assert.equal(r, '123');
  });

  it('coerces truthy string to boolean', () => {
    const r = value.cast('urn:test:boolean', 'true');
    assert.equal(r, true);
  });

  it('fills defaults on object properties', () => {
    const r = value.cast('urn:test:item', { name: 'Widget' }) as Record<string, unknown>;
    assert.equal(r['score'], 0);
  });

  it('coerces nested property types', () => {
    const r = value.cast('urn:test:item', { name: 'Widget', count: '5' }) as Record<string, unknown>;
    assert.equal(r['count'], 5);
  });

  it('does not throw on null input', () => {
    const r = value.cast('urn:test:item', null);
    assert.ok(typeof r === 'object');
  });

  it('uses graph-engine ref resolution for nested defaults and coercion', () => {
    const r = value.cast('urn:test:ref-metrics', {
      'metrics': { 'count': '5' }
    }) as Record<string, Record<string, unknown>>;

    assert.equal(r['metrics']['count'], 5);
    assert.deepEqual(value.cast('urn:test:ref-metrics', {}) as Record<string, unknown>, {
      'metrics': { 'count': 0 }
    });
  });
});

// ---------------------------------------------------------------------------
// clean
// ---------------------------------------------------------------------------

describe('Value.clean()', () => {
  const registry = new SchemaRegistry();
  registry.register({
    $id: 'urn:test:address',
    type: 'object',
    properties: {
      street: { type: 'string' },
    },
  } as const);
  registry.register({
    $id: 'urn:test:user',
    type: 'object',
    properties: {
      name:  { type: 'string' },
      email: { type: 'string' },
      address: { $ref: 'urn:test:address' },
    },
  } as const);
  const value = new Value(registry);

  it('removes undeclared properties', () => {
    const r = value.clean('urn:test:user', { name: 'Alice', email: 'a@b.com', secret: 'x' });
    assert.ok(!('secret' in (r as object)));
    assert.equal((r as Record<string, unknown>)['name'], 'Alice');
  });

  it('preserves declared properties', () => {
    const r = value.clean('urn:test:user', { name: 'Alice', email: 'a@b.com' }) as Record<string, unknown>;
    assert.equal(r['name'], 'Alice');
    assert.equal(r['email'], 'a@b.com');
  });

  it('recursively cleans nested objects', () => {
    const r = value.clean('urn:test:user', {
      name: 'Alice',
      address: { street: '1 Main St', hack: 'x' },
    }) as Record<string, Record<string, unknown>>;
    assert.ok(!('hack' in r['address']));
    assert.equal(r['address']['street'], '1 Main St');
  });

  it('does not mutate original', () => {
    const input = { name: 'Alice', secret: 'x' };
    value.clean('urn:test:user', input);
    assert.ok('secret' in input);
  });
});
