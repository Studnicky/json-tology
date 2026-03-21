import {
  describe, it
} from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/modules/registry/SchemaRegistry.js';
import { GraphOntologySerializer } from '../../src/modules/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/modules/ontology/GraphShaclSerializer.js';

const AddressSchema = {
  '$id': 'https://example.io/Address',
  'properties': {
    'city': { 'type': 'string' },
    'street': { 'type': 'string' }
  },
  'required': [
    'street',
    'city'
  ],
  'type': 'object'
} as const;

const PersonSchema = {
  '$defs': {
    'Address': {
      'properties': {
        'city': { 'type': 'string' },
        'street': { 'type': 'string' }
      },
      'required': [
        'street',
        'city'
      ],
      'type': 'object'
    }
  },
  '$id': 'https://example.io/Person',
  'properties': {
    'address': {
      '$ref': '#/$defs/Address',
      'http://www.w3.org/2000/01/rdf-schema#range': 'https://example.io/Address'
    },
    'friends': {
      'http://www.w3.org/2000/01/rdf-schema#range': 'https://example.io/Person',
      'items': { 'type': 'object' },
      'type': 'array'
    },
    'name': { 'type': 'string' },
    'tag': {
      'http://www.w3.org/2000/01/rdf-schema#domain': 'https://example.io/Taggable',
      'type': 'string'
    }
  },
  'required': ['name'],
  'type': 'object'
} as const;

function makeRegistry(): SchemaRegistry {
  const reg = new SchemaRegistry();

  reg.register(AddressSchema as unknown as Record<string, unknown>);
  reg.register(PersonSchema as unknown as Record<string, unknown>);

  return reg;
}

void describe('rdfs:domain and rdfs:range', () => {
  void it('validates range constraints on object and array properties', () => {
    const reg = makeRegistry();
    const scenarios: Array<[unknown, boolean]> = [
      // Valid object with range
      [
        {
          'address': {
            'city': 'Springfield',
            'street': '123 Main'
          },
          'name': 'Alice'
        },
        true
      ],
      // Invalid object (missing city)
      [
        {
          'address': { 'street': '123 Main' },
          'name': 'Alice'
        },
        false
      ],
      // Valid array items with range
      [
        {
          'friends': [
            { 'name': 'Bob' },
            { 'name': 'Charlie' }
          ],
          'name': 'Alice'
        },
        true
      ],
      // Invalid array item (missing required name)
      [
        {
          'friends': [
            { 'name': 'Bob' },
            { 'notName': 'missing' }
          ],
          'name': 'Alice'
        },
        false
      ],
      // Domain is annotation-only (no validation effect)
      [
        {
          'name': 'Alice',
          'tag': 'hello'
        },
        true
      ],
      // Combined $ref + rdfs:range — both constraints enforced
      [
        {
          'address': {
            'city': 'Springfield',
            'street': '123 Main'
          },
          'name': 'Alice'
        },
        true
      ]
    ];

    for (const [
      data,
      expectedValid
    ] of scenarios) {
      const errors = reg.validate('https://example.io/Person', data);

      assert.equal(errors.length === 0, expectedValid);
    }
  });

  void it('treats unregistered range schema as annotation-only', () => {
    const reg = new SchemaRegistry();

    reg.register({
      '$id': 'https://example.io/WithUnknownRange',
      'properties': {
        'data': {
          'http://www.w3.org/2000/01/rdf-schema#range': 'https://example.io/NonExistent',
          'type': 'object'
        }
      },
      'type': 'object'
    });
    assert.deepEqual(reg.validate('https://example.io/WithUnknownRange', { 'data': { 'anything': 'goes' } }), []);
  });

  void it('uses explicit domain/range in OWL output', () => {
    const reg = makeRegistry();
    const serializer = new GraphOntologySerializer();
    const nodes = serializer.serialize(reg.listGraphs()) as Array<Record<string, unknown>>;

    const addressProp = nodes.find((node) => {
      return node['@id'] === 'https://example.io/Person#address';
    });

    assert.ok(addressProp !== undefined);
    assert.deepEqual(addressProp['http://www.w3.org/2000/01/rdf-schema#range'], { '@id': 'https://example.io/Address' });

    const tagProp = nodes.find((node) => {
      return node['@id'] === 'https://example.io/Person#tag';
    });

    assert.ok(tagProp !== undefined);
    assert.deepEqual(tagProp['http://www.w3.org/2000/01/rdf-schema#domain'], { '@id': 'https://example.io/Taggable' });

    const personClass = nodes.find((node) => {
      return node['@id'] === 'https://example.io/Person' && node['@type'] === 'http://www.w3.org/2002/07/owl#Class';
    });

    assert.ok(personClass !== undefined);
    const subs = personClass['http://www.w3.org/2000/01/rdf-schema#subClassOf'] as Array<Record<string, unknown>>;

    assert.ok(Array.isArray(subs));
    const avf = subs.find((restriction) => {
      const onPropId = restriction['http://www.w3.org/2002/07/owl#onProperty'] as Record<string, unknown> | undefined;

      return onPropId?.['@id'] === 'https://example.io/Person#friends'
      && restriction['http://www.w3.org/2002/07/owl#allValuesFrom'] !== undefined;
    });

    assert.ok(avf !== undefined);
    assert.deepEqual(avf['http://www.w3.org/2002/07/owl#allValuesFrom'], { '@id': 'https://example.io/Person' });
  });

  void it('uses explicit range for sh:class in SHACL output', () => {
    const reg = makeRegistry();
    const serializer = new GraphShaclSerializer();
    const shapes = serializer.serialize(reg.listGraphs()) as Array<Record<string, unknown>>;

    const personShape = shapes.find((shape) => {
      return shape['@id'] === 'https://example.io/Person';
    });

    assert.ok(personShape !== undefined);
    const propShapes = personShape['http://www.w3.org/ns/shacl#property'] as Array<Record<string, unknown>>;

    assert.ok(Array.isArray(propShapes));

    const addressPS = propShapes.find((ps) => {
      const pathId = ps['http://www.w3.org/ns/shacl#path'] as Record<string, unknown> | undefined;

      return pathId?.['@id'] === 'https://example.io/Person#address';
    });

    assert.ok(addressPS !== undefined);
    assert.deepEqual(addressPS['http://www.w3.org/ns/shacl#class'], { '@id': 'https://example.io/Address' });
    assert.equal(addressPS['http://www.w3.org/ns/shacl#node'], undefined);

    const tagPS = propShapes.find((ps) => {
      const pathId = ps['http://www.w3.org/ns/shacl#path'] as Record<string, unknown> | undefined;

      return pathId?.['@id'] === 'https://example.io/Taggable#tag';
    });

    assert.ok(tagPS !== undefined);
  });

  void it('serializes extended predicates (disjointWith, inverseOf, transitive, symmetric)', () => {
    const registry = new SchemaRegistry();

    registry.register({
      '$id': 'https://example.io/Dog',
      'disjointWith': 'https://example.io/Cat',
      'properties': { 'name': { 'type': 'string' as const } },
      'type': 'object' as const
    });
    registry.register({
      '$id': 'https://example.io/Cat',
      'properties': { 'name': { 'type': 'string' as const } },
      'type': 'object' as const
    });
    registry.register({
      '$id': 'https://example.io/Pet',
      'properties': { 'owner': { '$ref': 'https://example.io/Owner' } },
      'type': 'object' as const
    });
    registry.register({
      '$id': 'https://example.io/Owner',
      'properties': {
        'pets': {
          'inverseOf': 'https://example.io/Pet#owner',
          'items': { '$ref': 'https://example.io/Pet' },
          'type': 'array' as const
        }
      },
      'type': 'object' as const
    });
    registry.register({
      '$id': 'https://example.io/GraphNode',
      'properties': {
        'ancestor': {
          'transitive': true,
          'type': 'string' as const
        },
        'sibling': {
          'symmetric': true,
          'type': 'string' as const
        }
      },
      'type': 'object' as const
    });

    const owlSerializer = new GraphOntologySerializer();
    const output = owlSerializer.serialize(registry.listGraphs()) as Array<Record<string, unknown>>;

    // disjointWith
    const dogClass = output.find((node) => {
      return node['@id'] === 'https://example.io/Dog';
    });

    assert.ok(dogClass);
    assert.deepEqual(dogClass['http://www.w3.org/2002/07/owl#disjointWith'], { '@id': 'https://example.io/Cat' });

    // inverseOf
    const petsProp = output.find((node) => {
      return node['@id'] === 'https://example.io/Owner#pets';
    });

    assert.ok(petsProp);
    assert.deepEqual(petsProp['http://www.w3.org/2002/07/owl#inverseOf'], { '@id': 'https://example.io/Pet#owner' });

    // transitive and symmetric
    const ancestorProp = output.find((node) => {
      return node['@id'] === 'https://example.io/GraphNode#ancestor';
    });

    assert.ok(ancestorProp);
    assert.ok(Array.isArray(ancestorProp['@type']));
    assert.ok((ancestorProp['@type'] as string[]).includes('http://www.w3.org/2002/07/owl#TransitiveProperty'));

    const siblingProp = output.find((node) => {
      return node['@id'] === 'https://example.io/GraphNode#sibling';
    });

    assert.ok(siblingProp);
    assert.ok(Array.isArray(siblingProp['@type']));
    assert.ok((siblingProp['@type'] as string[]).includes('http://www.w3.org/2002/07/owl#SymmetricProperty'));
  });
});
