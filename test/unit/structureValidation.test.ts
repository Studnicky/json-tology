import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/schema/SchemaGraph.js';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';

describe('Structure Validation', () => {
  it('detects inline nested object', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      'properties': {
        'name': { 'type': 'string' },
        'address': {
          'type': 'object',
          'properties': {
            'street': { 'type': 'string' }
          }
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].rule, 'inline-object');
    assert.equal(warnings[0].path, '/properties/address');
  });

  it('$ref is clean — no warnings', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      'properties': {
        'name': { 'type': 'string' },
        'address': { '$ref': 'https://example.io/Address' }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });

  it('$defs entries are exempt', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      '$defs': {
        'Address': {
          'type': 'object',
          'properties': {
            'street': { 'type': 'string' }
          }
        }
      },
      'properties': {
        'address': { '$ref': '#/$defs/Address' }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });

  it('bare object without properties is exempt', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      'properties': {
        'metadata': { 'type': 'object' }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });

  it('always throws on inline objects during registration', () => {
    const registry = new SchemaRegistry();

    assert.throws(() => {
      registry.register({
        '$id': 'https://example.io/User',
        'type': 'object',
        'properties': {
          'address': {
            'type': 'object',
            'properties': {
              'street': { 'type': 'string' }
            }
          }
        }
      });
    }, /Structure validation failed/);
  });

  it('registration succeeds with proper $ref patterns', () => {
    const registry = new SchemaRegistry();
    const AddressSchema = {
      '$id': 'https://example.io/Address',
      'type': 'object',
      'properties': {
        'street': { 'type': 'string' }
      }
    };
    const UserSchema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      'properties': {
        'address': { '$ref': 'https://example.io/Address' }
      }
    };

    assert.doesNotThrow(() => {
      registry.register([AddressSchema, UserSchema]);
    });
  });

  it('deeply nested inline objects produce multiple warnings', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      'properties': {
        'address': {
          'type': 'object',
          'properties': {
            'city': {
              'type': 'object',
              'properties': {
                'name': { 'type': 'string' }
              }
            }
          }
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 2);
    assert.ok(warnings.some((w) => w.path === '/properties/address'));
    assert.ok(warnings.some((w) => w.path === '/properties/address/properties/city'));
  });

  it('array items with inline object produces warning', () => {
    const schema = {
      '$id': 'https://example.io/UserList',
      'type': 'object',
      'properties': {
        'users': {
          'type': 'array',
          'items': {
            'type': 'object',
            'properties': {
              'name': { 'type': 'string' }
            }
          }
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].path, '/properties/users/items');
  });

  it('inline object with its own $id is exempt', () => {
    const schema = {
      '$id': 'https://example.io/User',
      'type': 'object',
      'properties': {
        'address': {
          '$id': 'https://example.io/Address',
          'type': 'object',
          'properties': {
            'street': { 'type': 'string' }
          }
        }
      }
    };
    const graph = new SchemaGraph(schema);
    const warnings = graph.validateStructure();

    assert.equal(warnings.length, 0);
  });
});
