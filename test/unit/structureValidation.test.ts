import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/modules/graph/SchemaGraph.js';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';

void describe('Structure Validation', () => {
  void it('detects inline nested object', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'properties': {
        'address': {
          'properties': { 'street': { 'type': 'string' } },
          'type': 'object'
        },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].rule, 'inline-object');
    assert.equal(warnings[0].path, '/properties/address');
  });

  void it('$ref is clean — no warnings', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'properties': {
        'address': { '$ref': 'https://example.io/Address' },
        'name': { 'type': 'string' }
      },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });

  void it('$defs entries are exempt', () => {
    const schema = {
      '$defs': {
        'Address': {
          'properties': { 'street': { 'type': 'string' } },
          'type': 'object'
        }
      },
      '$id': 'https://example.io/User',
      'properties': { 'address': { '$ref': '#/$defs/Address' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });

  void it('bare object without properties is exempt', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'properties': { 'metadata': { 'type': 'object' } },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });

  void it('always throws on inline objects during registration', () => {
    const registry = new SchemaRegistry();

    assert.throws(() => {
      registry.register({
        '$id': 'https://example.io/User',
        'properties': {
          'address': {
            'properties': { 'street': { 'type': 'string' } },
            'type': 'object'
          }
        },
        'type': 'object'
      });
    }, /Structure validation failed/u);
  });

  void it('registration succeeds with proper $ref patterns', () => {
    const registry = new SchemaRegistry();
    const AddressSchema = {
      '$id': 'https://example.io/Address',
      'properties': { 'street': { 'type': 'string' } },
      'type': 'object'
    };
    const UserSchema = {
      '$id': 'https://example.io/User',
      'properties': { 'address': { '$ref': 'https://example.io/Address' } },
      'type': 'object'
    };

    assert.doesNotThrow(() => {
      registry.register([
        AddressSchema,
        UserSchema
      ]);
    });
  });

  void it('deeply nested inline objects produce multiple warnings', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'properties': {
        'address': {
          'properties': {
            'city': {
              'properties': { 'name': { 'type': 'string' } },
              'type': 'object'
            }
          },
          'type': 'object'
        }
      },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 2);
    assert.ok(warnings.some((warning) => {
      return warning.path === '/properties/address';
    }));
    assert.ok(warnings.some((warning) => {
      return warning.path === '/properties/address/properties/city';
    }));
  });

  void it('array items with inline object produces warning', () => {
    const schema = {
      '$id': 'https://example.io/UserList',
      'properties': {
        'users': {
          'items': {
            'properties': { 'name': { 'type': 'string' } },
            'type': 'object'
          },
          'type': 'array'
        }
      },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].path, '/properties/users/items');
  });

  void it('inline object with its own $id is exempt', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'properties': {
        'address': {
          '$id': 'https://example.io/Address',
          'properties': { 'street': { 'type': 'string' } },
          'type': 'object'
        }
      },
      'type': 'object'
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });
});
