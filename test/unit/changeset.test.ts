/**
 * Changeset tests — ordered diff operations: isEmpty, length, apply
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Changeset } from '../../src/modules/data/Changeset.js';
import type { DiffOpType } from '../../src/types/diff.js';

void describe('Changeset', () => {
  void it('isEmpty is true for empty operations', () => {
    const cs = new Changeset([]);

    assert.equal(cs.isEmpty, true);
  });

  void it('isEmpty is false when operations exist', () => {
    const ops: DiffOpType[] = [{ op: 'set', path: '/a', value: 1 }];
    const cs = new Changeset(ops);

    assert.equal(cs.isEmpty, false);
  });

  void it('length returns operation count', () => {
    assert.equal(new Changeset([]).length, 0);
    assert.equal(new Changeset([{ op: 'set', path: '/a', value: 1 }]).length, 1);
    assert.equal(new Changeset([
      { op: 'set', path: '/a', value: 1 },
      { op: 'delete', path: '/b' },
      { op: 'set', path: '/c', value: 3 },
    ]).length, 3);
  });

  void it('apply with set operations modifies values', () => {
    const cs = new Changeset([
      { op: 'set', path: '/name', value: 'Bob' },
    ]);
    const result = cs.apply({ name: 'Alice', age: 30 }) as Record<string, unknown>;

    assert.equal(result.name, 'Bob');
    assert.equal(result.age, 30);
  });

  void it('apply with del operations removes values', () => {
    const cs = new Changeset([
      { op: 'delete', path: '/age' },
    ]);
    const result = cs.apply({ name: 'Alice', age: 30 }) as Record<string, unknown>;

    assert.equal(result.name, 'Alice');
    assert.equal('age' in result, false);
  });

  void it('apply does not mutate the original', () => {
    const original = { name: 'Alice', age: 30 };
    const cs = new Changeset([
      { op: 'set', path: '/name', value: 'Bob' },
      { op: 'delete', path: '/age' },
    ]);

    cs.apply(original);

    assert.equal(original.name, 'Alice');
    assert.equal(original.age, 30);
  });

  void it('apply handles nested path operations', () => {
    const cs = new Changeset([
      { op: 'set', path: '/address/city', value: 'Portland' },
    ]);
    const result = cs.apply({
      name: 'Alice',
      address: { city: 'Seattle', zip: '98101' },
    }) as { name: string; address: { city: string; zip: string } };

    assert.equal(result.address.city, 'Portland');
    assert.equal(result.address.zip, '98101');
    assert.equal(result.name, 'Alice');
  });

  void it('apply chains multiple operations in order', () => {
    const cs = new Changeset([
      { op: 'set', path: '/x', value: 10 },
      { op: 'set', path: '/y', value: 20 },
      { op: 'delete', path: '/z' },
    ]);
    const result = cs.apply({ x: 1, y: 2, z: 3 }) as Record<string, unknown>;

    assert.equal(result.x, 10);
    assert.equal(result.y, 20);
    assert.equal('z' in result, false);
  });

  void it('operations is readonly', () => {
    const ops: DiffOpType[] = [{ op: 'set', path: '/a', value: 1 }];
    const cs = new Changeset(ops);

    assert.equal(cs.operations.length, 1);
    assert.equal(cs.operations[0].op, 'set');
  });
});
