/**
 * SchemaRegistry.findDuplicates() — unit tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const EmailSchema = {
  '$id': 'urn:test:Email',
  'format': 'email',
  'type': 'string'
} as const;

const PersonSchema = {
  '$id': 'urn:test:Person',
  'properties': {
    'email': {
      'format': 'email',
      'type': 'string'
    },
    'name': { 'type': 'string' }
  },
  'type': 'object'
} as const;

void describe('SchemaRegistry.findDuplicates()', () => {
  void it('returns empty when no duplicates', () => {
    const registry = new SchemaRegistry();

    registry.register(EmailSchema as unknown as Record<string, unknown>);
    registry.register({
      '$id': 'urn:test:Other',
      'type': 'number'
    });

    assert.deepStrictEqual(registry.findDuplicates(), []);
  });

  void it('detects structurally-identical leaf shape that matches a registered schema', () => {
    const registry = new SchemaRegistry();

    registry.register(EmailSchema as unknown as Record<string, unknown>);
    registry.register(PersonSchema as unknown as Record<string, unknown>);

    const dups = registry.findDuplicates();

    assert.ok(dups.length > 0, 'should find at least one duplicate');

    const dup = dups.find((entry) => {
      return entry.equivalentTo === EmailSchema.$id;
    });

    assert.ok(dup !== undefined, 'duplicate should point to EmailSchema');
    assert.ok(dup.pointer.includes('email'), 'pointer should reference email property');
  });

  void it('ignores description/title differences when hashing', () => {
    const Base = {
      '$id': 'urn:test:Base2',
      'description': 'A base type',
      'pattern': '^\\d+$',
      'type': 'string'
    } as const;

    const Container = {
      '$id': 'urn:test:Container2',
      'properties': {
        'code': {
          'pattern': '^\\d+$',
          'title': 'Different title',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;

    const registry = new SchemaRegistry();

    registry.register(Base as unknown as Record<string, unknown>);
    registry.register(Container as unknown as Record<string, unknown>);

    const dups = registry.findDuplicates();

    assert.ok(dups.length > 0, 'structural match despite different titles');
  });

  void it('reports correct schemaId and equivalentTo fields', () => {
    const registry = new SchemaRegistry();

    registry.register(EmailSchema as unknown as Record<string, unknown>);
    registry.register(PersonSchema as unknown as Record<string, unknown>);

    const dups = registry.findDuplicates();
    const dup = dups[0];

    assert.ok(typeof dup.schemaId === 'string', 'schemaId is string');
    assert.ok(typeof dup.equivalentTo === 'string', 'equivalentTo is string');
    assert.ok(typeof dup.pointer === 'string', 'pointer is string');
    assert.ok(typeof dup.shape === 'object', 'shape is object');
  });

  void it('returns empty when only $ref properties exist', () => {
    const registry = new SchemaRegistry();

    registry.register(EmailSchema as unknown as Record<string, unknown>);
    registry.register({
      '$id': 'urn:test:RefOnly',
      'properties': { 'email': { '$ref': 'urn:test:Email' } },
      'type': 'object'
    });

    const dups = registry.findDuplicates();

    assert.deepStrictEqual(dups, [], 'no dups when using $ref');
  });
});
