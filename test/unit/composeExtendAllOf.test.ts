/**
 * Compose.extend — allOf+$ref output shape tests
 */

import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { Compose } from '../../src/modules/composition/Compose.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

const PersonSchema = {
  '$id': 'https://example.io/Person',
  'properties': {
    'age': { 'type': 'number' },
    'name': { 'type': 'string' }
  },
  'required': ['name'],
  'type': 'object'
} as const;

void describe('Compose.extend() allOf+$ref shape', () => {
  void it('emits allOf with $ref to parent as first member', () => {
    const result = Compose.extend(PersonSchema, { 'role': { 'type': 'string' } } as const, 'https://example.io/Employee') as unknown as {
      '$id': string;
      'allOf': Array<Record<string, unknown>>;
    };

    assert.ok(Array.isArray(result.allOf), 'has allOf');
    assert.strictEqual(result.allOf.length, 2, 'allOf has 2 members');
    assert.strictEqual((result.allOf[0] as { '$ref': string }).$ref, 'https://example.io/Person', '$ref to parent');
  });

  void it('additions block has type:object and new properties', () => {
    const result = Compose.extend(PersonSchema, { 'role': { 'type': 'string' } } as const, 'https://example.io/Employee') as unknown as {
      '$id': string;
      'allOf': Array<Record<string, unknown>>;
    };

    const additions = result.allOf[1];

    assert.strictEqual(additions.type, 'object');
    const props = additions.properties as Record<string, unknown>;

    assert.ok('role' in props, 'role in additions');
  });

  void it('runtime validation validates parent + child properties', () => {
    const EmployeeSchema = Compose.extend(PersonSchema, { 'role': { 'type': 'string' } } as const, 'https://example.io/Employee2');

    const registry = new SchemaRegistry();

    registry.register(PersonSchema as unknown as Record<string, unknown>);
    registry.register(EmployeeSchema as unknown as Record<string, unknown>);

    const validEmployee = {
      'name': 'Alice',
      'role': 'engineer'
    };

    assert.ok(registry.validate('https://example.io/Employee2', validEmployee).ok);
  });

  void it('chain extend: grandchild gets all ancestor properties at runtime', () => {
    const ManagerSchema = Compose.extend(PersonSchema, { 'department': { 'type': 'string' } } as const, 'https://example.io/Manager');

    const SeniorManagerSchema = Compose.extend(ManagerSchema as unknown as Record<string, unknown> & {
      readonly '$id': string;
    }, { 'budget': { 'type': 'number' } } as const, 'https://example.io/SeniorManager');

    const registry = new SchemaRegistry();

    registry.register(PersonSchema as unknown as Record<string, unknown>);
    registry.register(ManagerSchema as unknown as Record<string, unknown>);
    registry.register(SeniorManagerSchema as unknown as Record<string, unknown>);

    assert.ok(registry.get('https://example.io/SeniorManager') !== undefined);
  });

  void it('does not mutate the source schema', () => {
    const original = JSON.stringify(PersonSchema);

    Compose.extend(PersonSchema, { 'extra': { 'type': 'boolean' } } as const, 'https://example.io/Mutate');
    assert.strictEqual(JSON.stringify(PersonSchema), original);
  });
});
