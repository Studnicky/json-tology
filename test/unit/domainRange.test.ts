import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SchemaRegistry } from '../../src/schema/SchemaRegistry.js';
import { GraphOntologySerializer } from '../../src/ontology/GraphOntologySerializer.js';
import { GraphShaclSerializer } from '../../src/ontology/GraphShaclSerializer.js';

const AddressSchema = {
  $id: 'https://example.io/Address',
  type: 'object',
  properties: {
    street: { type: 'string' },
    city: { type: 'string' }
  },
  required: ['street', 'city']
} as const;

const PersonSchema = {
  $id: 'https://example.io/Person',
  type: 'object',
  properties: {
    name: { type: 'string' },
    address: {
      'rdfs:range': 'https://example.io/Address',
      $ref: '#/$defs/Address'
    },
    friends: {
      type: 'array',
      items: { type: 'object' },
      'rdfs:range': 'https://example.io/Person'
    },
    tag: {
      type: 'string',
      'rdfs:domain': 'https://example.io/Taggable'
    }
  },
  required: ['name'],
  $defs: {
    Address: {
      type: 'object',
      properties: {
        street: { type: 'string' },
        city: { type: 'string' }
      },
      required: ['street', 'city']
    }
  }
} as const;

function makeRegistry(): SchemaRegistry {
  const reg = new SchemaRegistry();
  reg.register(AddressSchema as unknown as Record<string, unknown>);
  reg.register(PersonSchema as unknown as Record<string, unknown>);
  return reg;
}

describe('rdfs:domain and rdfs:range', () => {
  describe('validation', () => {
    it('rdfs:range on object property validates value against range schema', () => {
      const reg = makeRegistry();
      const errors = reg.validate('https://example.io/Person', {
        name: 'Alice',
        address: { street: '123 Main', city: 'Springfield' }
      });
      assert.deepEqual(errors, []);
    });

    it('rdfs:range on object property rejects invalid value', () => {
      const reg = makeRegistry();
      const errors = reg.validate('https://example.io/Person', {
        name: 'Alice',
        address: { street: '123 Main' } // missing city
      });
      assert.ok(errors.length > 0, 'should have validation errors');
      assert.ok(errors.some(e => e.includes('city') || e.includes('required')));
    });

    it('rdfs:range on array property validates each item against range schema', () => {
      const reg = makeRegistry();
      // friends items should be validated against Person schema
      const errors = reg.validate('https://example.io/Person', {
        name: 'Alice',
        friends: [
          { name: 'Bob' },
          { name: 'Charlie' }
        ]
      });
      assert.deepEqual(errors, []);
    });

    it('rdfs:range on array property rejects invalid items', () => {
      const reg = makeRegistry();
      const errors = reg.validate('https://example.io/Person', {
        name: 'Alice',
        friends: [
          { name: 'Bob' },
          { notName: 'missing name field' } // missing required 'name'
        ]
      });
      assert.ok(errors.length > 0, 'should have validation errors for invalid item');
    });

    it('rdfs:range with unregistered schema is annotation-only (no error)', () => {
      const UnknownRangeSchema = {
        $id: 'https://example.io/WithUnknownRange',
        type: 'object',
        properties: {
          data: {
            type: 'object',
            'rdfs:range': 'https://example.io/NonExistent'
          }
        }
      };
      const reg = new SchemaRegistry();
      reg.register(UnknownRangeSchema);
      const errors = reg.validate('https://example.io/WithUnknownRange', {
        data: { anything: 'goes' }
      });
      assert.deepEqual(errors, []);
    });

    it('rdfs:domain is annotation-only (no validation effect)', () => {
      const reg = makeRegistry();
      // tag has rdfs:domain but it should not affect validation
      const errors = reg.validate('https://example.io/Person', {
        name: 'Alice',
        tag: 'hello'
      });
      assert.deepEqual(errors, []);
    });

    it('combined: schema with both $ref and rdfs:range — both constraints enforced', () => {
      const reg = makeRegistry();
      // address has both $ref (to inline $defs/Address) and rdfs:range (to registered Address)
      // Both require street+city
      const errors = reg.validate('https://example.io/Person', {
        name: 'Alice',
        address: { street: '123 Main', city: 'Springfield' }
      });
      assert.deepEqual(errors, []);

      const errors2 = reg.validate('https://example.io/Person', {
        name: 'Alice',
        address: { street: '123 Main' }
      });
      assert.ok(errors2.length > 0);
    });
  });

  describe('OWL output', () => {
    it('uses explicit domain/range when declared', () => {
      const reg = makeRegistry();
      const serializer = new GraphOntologySerializer();
      const nodes = serializer.serialize(reg.listGraphs());

      // Find the address property node
      const addressProp = nodes.find((n: any) =>
        n['@id'] === 'https://example.io/Person#address'
      ) as any;
      assert.ok(addressProp, 'address property should exist');
      assert.deepEqual(addressProp['rdfs:range'], { '@id': 'https://example.io/Address' });

      // Find the tag property with explicit domain
      const tagProp = nodes.find((n: any) =>
        n['@id'] === 'https://example.io/Person#tag'
      ) as any;
      assert.ok(tagProp, 'tag property should exist');
      assert.deepEqual(tagProp['rdfs:domain'], { '@id': 'https://example.io/Taggable' });

      // Find the friends property - array with rdfsRange
      const friendsProp = nodes.find((n: any) =>
        n['@id'] === 'https://example.io/Person#friends'
      ) as any;
      assert.ok(friendsProp, 'friends property should exist');
      assert.deepEqual(friendsProp['jt:itemType'], { '@id': 'https://example.io/Person' });
    });
  });

  describe('SHACL output', () => {
    it('uses explicit range for sh:class', () => {
      const reg = makeRegistry();
      const serializer = new GraphShaclSerializer();
      const shapes = serializer.serialize(reg.listGraphs());

      // Find the Person NodeShape
      const personShape = shapes.find((s: any) =>
        s['@id'] === 'https://example.io/Person'
      ) as any;
      assert.ok(personShape, 'Person shape should exist');

      const propShapes = personShape['sh:property'] as any[];
      assert.ok(propShapes, 'should have property shapes');

      // address property should have sh:class from rdfsRange
      const addressPS = propShapes.find((ps: any) =>
        ps['sh:path']?.['@id'] === 'https://example.io/Person#address'
      );
      assert.ok(addressPS, 'address property shape should exist');
      assert.deepEqual(addressPS['sh:class'], { '@id': 'https://example.io/Address' });
      assert.equal(addressPS['sh:node'], undefined, 'sh:node should not be set when sh:class is');

      // tag property should use domain in path
      const tagPS = propShapes.find((ps: any) =>
        ps['sh:path']?.['@id'] === 'https://example.io/Taggable#tag'
      );
      assert.ok(tagPS, 'tag property shape with domain-based path should exist');
    });
  });

  describe('extended predicates in ontology output', () => {
    it('serializes disjointWith as owl:disjointWith', () => {
      const DogSchema = {
        $id: 'https://example.io/Dog',
        type: 'object' as const,
        disjointWith: 'https://example.io/Cat',
        properties: {
          name: { type: 'string' as const }
        }
      };
      const CatSchema = {
        $id: 'https://example.io/Cat',
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const }
        }
      };

      const registry = new SchemaRegistry();
      registry.register(DogSchema);
      registry.register(CatSchema);
      const owlSerializer = new GraphOntologySerializer();
      const graphs = registry.listGraphs();
      const output = owlSerializer.serialize(graphs) as Array<Record<string, unknown>>;
      const dogClass = output.find((n) => n['@id'] === 'https://example.io/Dog');
      assert.ok(dogClass);
      assert.deepEqual(dogClass['owl:disjointWith'], { '@id': 'https://example.io/Cat' });
    });

    it('serializes inverseOf as owl:inverseOf on properties', () => {
      const OwnerSchema = {
        $id: 'https://example.io/Owner',
        type: 'object' as const,
        properties: {
          pets: {
            type: 'array' as const,
            items: { $ref: 'https://example.io/Pet' },
            inverseOf: 'https://example.io/Pet#owner'
          }
        }
      };
      const PetSchema = {
        $id: 'https://example.io/Pet',
        type: 'object' as const,
        properties: {
          owner: { $ref: 'https://example.io/Owner' }
        }
      };

      const registry = new SchemaRegistry();
      registry.register(PetSchema);
      registry.register(OwnerSchema);
      const owlSerializer = new GraphOntologySerializer();
      const graphs = registry.listGraphs();
      const output = owlSerializer.serialize(graphs) as Array<Record<string, unknown>>;
      const petsProp = output.find((n) => n['@id'] === 'https://example.io/Owner#pets');
      assert.ok(petsProp);
      assert.deepEqual(petsProp['owl:inverseOf'], { '@id': 'https://example.io/Pet#owner' });
    });

    it('serializes transitive and symmetric as rdf:type annotations', () => {
      const GraphSchema = {
        $id: 'https://example.io/GraphNode',
        type: 'object' as const,
        properties: {
          ancestor: {
            type: 'string' as const,
            transitive: true
          },
          sibling: {
            type: 'string' as const,
            symmetric: true
          }
        }
      };

      const registry = new SchemaRegistry();
      registry.register(GraphSchema);
      const owlSerializer = new GraphOntologySerializer();
      const graphs = registry.listGraphs();
      const output = owlSerializer.serialize(graphs) as Array<Record<string, unknown>>;

      const ancestorProp = output.find((n) => n['@id'] === 'https://example.io/GraphNode#ancestor');
      assert.ok(ancestorProp);
      const ancestorTypes = ancestorProp['@type'];
      assert.ok(Array.isArray(ancestorTypes));
      assert.ok(ancestorTypes.includes('owl:TransitiveProperty'));

      const siblingProp = output.find((n) => n['@id'] === 'https://example.io/GraphNode#sibling');
      assert.ok(siblingProp);
      const siblingTypes = siblingProp['@type'];
      assert.ok(Array.isArray(siblingTypes));
      assert.ok(siblingTypes.includes('owl:SymmetricProperty'));
    });
  });
});
