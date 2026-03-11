import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaGraph } from '../../src/schema/SchemaGraph.js';

describe('SchemaGraph', () => {
  it('lowers pointer-addressable schema nodes', () => {
    const schema = {
      '$defs': {
        'address': {
          'properties': {
            'street/name': { 'type': 'string' }
          },
          'type': 'object'
        }
      },
      'properties': {
        'address': { '$ref': '#/$defs/address' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.rootNode.pointer, '');
    assert.deepEqual(
      graph.resolvePointer('/$defs/address').schema,
      schema.$defs.address
    );
    assert.deepEqual(
      graph.resolvePointer('/$defs/address/properties/street~1name').schema,
      schema.$defs.address.properties['street/name']
    );
  });

  it('indexes anchors and dynamic anchors as graph nodes', () => {
    const schema = {
      '$defs': {
        'anchored': {
          '$anchor': 'named',
          '$dynamicAnchor': 'dynamicNamed',
          'type': 'string'
        }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);

    assert.equal(graph.resolveFragment('named').pointer, '/$defs/anchored');
    assert.equal(graph.resolveFragment('dynamicNamed').pointer, '/$defs/anchored');
  });

  it('exposes graph relationships for object, array, and composition keywords', () => {
    const schema = {
      'allOf': [
        {
          'properties': {
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      ],
      'contains': { 'type': 'number' },
      'if': {
        'properties': {
          'kind': { 'const': 'person' }
        },
        'type': 'object'
      },
      'prefixItems': [
        { 'type': 'string' }
      ],
      'properties': {
        'age': { 'type': 'number' }
      },
      'then': {
        'properties': {
          'name': { 'type': 'string' }
        },
        'type': 'object'
      },
      'type': 'object',
      'unevaluatedProperties': false
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.entries(root, 'properties')[0]?.[0], 'age');
    assert.equal(graph.entries(root, 'properties')[0]?.[1].pointer, '/properties/age');
    assert.equal(graph.indexedChildren(root, 'prefixItems')[0]?.pointer, '/prefixItems/0');
    assert.equal(graph.indexedChildren(root, 'allOf')[0]?.pointer, '/allOf/0');
    assert.equal(graph.child(root, 'contains')?.pointer, '/contains');
    assert.equal(graph.child(root, 'if')?.pointer, '/if');
    assert.equal(graph.child(root, 'then')?.pointer, '/then');
    assert.equal(graph.child(root, 'unevaluatedProperties')?.pointer, '/unevaluatedProperties');
  });

  it('exposes keyword values through graph nodes', () => {
    const schema = {
      'default': { 'name': 'guest' },
      'maxProperties': 3,
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.keywordValue(root, 'type'), 'object');
    assert.equal(graph.keywordValue(root, 'maxProperties'), 3);
    assert.deepEqual(graph.keywordValue(root, 'required'), ['name']);
    assert.deepEqual(graph.keywordValue(root, 'default'), { 'name': 'guest' });
  });

  it('reuses cached relationship lookups for graph nodes', () => {
    const schema = {
      'allOf': [
        {
          'properties': {
            'name': { 'type': 'string' }
          },
          'type': 'object'
        }
      ],
      'properties': {
        'age': { 'type': 'number' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;

    assert.equal(graph.child(root, 'properties'), graph.child(root, 'properties'));
    assert.equal(graph.entries(root, 'properties'), graph.entries(root, 'properties'));
    assert.equal(graph.indexedChildren(root, 'allOf'), graph.indexedChildren(root, 'allOf'));
  });

  it('exposes cached semantic metadata for execution and ontology consumers', () => {
    const schema = {
      '$id': 'https://example.io/root',
      '$defs': {
        'Address': {
          '$dynamicAnchor': 'addressNode',
          'properties': {
            'street': { 'type': 'string' }
          },
          'required': ['street'],
          'type': 'object'
        }
      },
      'properties': {
        'address': {
          '$ref': '#/$defs/Address'
        },
        'name': { 'type': 'string' }
      },
      'dependentRequired': {
        'name': ['address']
      },
      'dependentSchemas': {
        'address': {
          'properties': {
            'kind': { 'const': 'home' }
          },
          'type': 'object'
        }
      },
      'required': ['name'],
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const root = graph.rootNode;
    const rootSemantics = graph.semantics(root);
    const addressSemantics = graph.semantics(graph.resolvePointer('/$defs/Address'));

    assert.equal(graph.semantics(root), rootSemantics);
    assert.deepEqual(rootSemantics.required, ['name']);
    assert.deepEqual(rootSemantics.schemaTypes, ['object']);
    assert.equal(rootSemantics.properties[0]?.[0], 'address');
    assert.equal(rootSemantics.properties[1]?.[0], 'name');
    assert.equal(rootSemantics.properties[0]?.[1].pointer, '/properties/address');
    assert.equal(rootSemantics.properties[0]?.[1].schema.$ref, '#/$defs/Address');
    assert.deepEqual(rootSemantics.dependentRequired, { 'name': ['address'] });
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[0], 'address');
    assert.equal(rootSemantics.dependentSchemaEntries[0]?.[1].pointer, '/dependentSchemas/address');
    assert.equal(addressSemantics.dynamicAnchor, 'addressNode');
    assert.deepEqual(addressSemantics.required, ['street']);
    assert.equal(rootSemantics.properties[0]?.[1] && graph.semantics(rootSemantics.properties[0][1]).refTargetNode?.id, 'https://example.io/root#/$defs/Address');
  });

  it('resolves local refs through canonical graph semantics', () => {
    const schema = {
      '$id': 'https://example.io/root',
      '$defs': {
        'Address': {
          '$anchor': 'address',
          'type': 'object'
        }
      },
      'properties': {
        'byAnchor': { '$ref': '#address' },
        'byPointer': { '$ref': '#/$defs/Address' },
        'self': { '$ref': '#' }
      },
      'type': 'object'
    } as const;
    const graph = new SchemaGraph(schema);
    const rootSemantics = graph.semantics(graph.rootNode);
    const byAnchor = graph.semantics(rootSemantics.properties[0][1]);
    const byPointer = graph.semantics(rootSemantics.properties[1][1]);
    const self = graph.semantics(rootSemantics.properties[2][1]);

    assert.equal(byAnchor.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(byPointer.refTargetNode?.id, 'https://example.io/root#/$defs/Address');
    assert.equal(self.refTargetNode?.id, 'https://example.io/root');
  });
});
